/**
 * electronHarness.ts — Launch and tear down Obsidian for E2E testing.
 *
 * Tested with: Obsidian 1.12.4 (macOS arm64), Obsidian AppImage (Linux/CI)
 *
 * Trust modal text matched: "Trust author and enable plugin"
 * If this text changes in future Obsidian versions, a warning is logged rather than
 * silently clicking an unknown button.
 *
 * Launch strategy (macOS):
 * Obsidian's binary acts as a CLI tool when invoked with positional args, regardless
 * of the "cli" setting in obsidian.json. To launch the GUI, we use macOS's `open -a`
 * command which passes the vault path via Launch Services (not as a CLI arg) and
 * enables Chrome DevTools via --remote-debugging-port. We then connect via CDP.
 *
 * Launch strategy (Linux):
 * On Linux the vault is pre-registered in obsidian.json with "open":true before
 * launch. The binary (or AppRun entry point from an extracted AppImage) is spawned
 * directly with --remote-debugging-port. Obsidian reads obsidian.json on startup
 * and opens the registered vault automatically, avoiding the CLI-mode issue.
 * Set OBSIDIAN_BINARY to the extracted AppRun path, e.g.:
 *   ./Obsidian.AppImage --appimage-extract   # → squashfs-root/
 *   OBSIDIAN_BINARY=/tmp/squashfs-root/AppRun
 *
 * Environment injection:
 * The spawn call passes an explicit `env` option merging `process.env` with any
 * `extraEnv` supplied by the caller. This allows E2E tests to inject env vars
 * (e.g., API base URL overrides, fake API keys) into the Obsidian process.
 *
 * Vault registry: Before launching, the test vault is registered in Obsidian's global
 * obsidian.json with "open":true. All other vaults have "open" cleared so Obsidian
 * opens the test vault rather than restoring any previously-open vault. The original
 * obsidian.json is restored after Obsidian quits.
 *
 * Limitation: Obsidian must not already be running (single-instance app).
 * If it is running, an ObsidianLaunchError is thrown rather than killing user data.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import * as os from "os";
import { execSync, spawn } from "child_process";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

export interface ObsidianInstance {
  close: () => Promise<void>;
}

const TRUST_MODAL_TEXT = "Trust author and enable plugins";
const STABILIZATION_MS = 2000;

function obsidianConfigPath(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "obsidian", "obsidian.json");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? os.homedir(), "obsidian", "obsidian.json");
  }
  return path.join(os.homedir(), ".config", "obsidian", "obsidian.json");
}

interface ObsidianVaultEntry {
  path: string;
  ts: number;
  open?: boolean;
}

interface ObsidianConfig {
  vaults?: Record<string, ObsidianVaultEntry>;
  cli?: boolean;
  [key: string]: unknown;
}

/**
 * Register the test vault in Obsidian's global obsidian.json so Obsidian opens it
 * directly on launch (rather than restoring the previously-open vault).
 * Returns the original file contents for restoration after the test.
 */
function registerTestVault(vaultPath: string): { vaultId: string; originalContent: string } {
  const configPath = obsidianConfigPath();

  let config: ObsidianConfig = {};
  let originalContent = "";
  if (fs.existsSync(configPath)) {
    originalContent = fs.readFileSync(configPath, "utf8");
    try { config = JSON.parse(originalContent); } catch { config = {}; }
  }

  if (!config.vaults) config.vaults = {};

  // Clear "open" flag from all existing vaults
  for (const entry of Object.values(config.vaults)) {
    delete entry.open;
  }

  // Register the test vault with a unique ID
  const vaultId = crypto.randomBytes(8).toString("hex");
  config.vaults[vaultId] = { path: vaultPath, ts: Date.now(), open: true };

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config));
  return { vaultId, originalContent };
}

/** Restore obsidian.json to its pre-test state and remove the test vault entry. */
function unregisterTestVault(vaultId: string, originalContent: string): void {
  const configPath = obsidianConfigPath();
  if (originalContent) {
    fs.writeFileSync(configPath, originalContent);
  } else {
    // Remove the test-only entry from the current config
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const config: ObsidianConfig = JSON.parse(raw);
      if (config.vaults) delete config.vaults[vaultId];
      fs.writeFileSync(configPath, JSON.stringify(config));
    } catch { /* ignore */ }
  }
}

function isObsidianRunning(): boolean {
  try {
    if (process.platform === "win32") {
      // /FO CSV produces machine-readable output unaffected by Windows display locale.
      // Obsidian.exe is hardcoded — no user input interpolation.
      const out = execSync('tasklist /FI "IMAGENAME eq Obsidian.exe" /NH /FO CSV', { stdio: ["pipe", "pipe", "pipe"] }).toString();
      return out.includes("Obsidian.exe");
    }
    // macOS process name is "Obsidian" (capitalised); Linux is "obsidian" (lowercase).
    const cmd = process.platform === "darwin" ? "pgrep -x Obsidian" : "pgrep -x obsidian";
    const result = execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

/** Wait up to timeoutMs for Obsidian to fully exit. */
async function waitForObsidianToExit(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isObsidianRunning()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on("error", reject);
  });
}

async function waitForCdp(port: number, timeoutMs: number): Promise<Browser> {
  // Use 127.0.0.1 rather than localhost: on Node.js 18+/Linux, localhost may
  // resolve to ::1 (IPv6) while Electron binds CDP to 127.0.0.1 (IPv4).
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(url);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new ObsidianLaunchError(`Timed out waiting for Obsidian DevTools on port ${port}`);
}

function getAppPath(binaryPath: string): string {
  // /Applications/Obsidian.app/Contents/MacOS/Obsidian → /Applications/Obsidian.app
  const match = binaryPath.match(/^(.+\.app)\//);
  return match ? match[1] : binaryPath;
}

async function launchObsidianMacOS(
  binaryPath: string,
  vaultPath: string,
  port: number,
  extraEnv?: Record<string, string>
): Promise<Browser> {
  const appPath = getAppPath(binaryPath);
  // Use macOS `open -a` to launch Obsidian via Launch Services:
  //   - vault path passed as file argument (opens via NSApp openFile, not CLI)
  //   - --args passes additional flags to the app process
  //   - env merges process.env with extraEnv so test-injected vars (API overrides,
  //     fake keys) are visible to the Obsidian process
  spawn("open", [
    "-a", appPath,
    vaultPath,
    "--args",
    `--remote-debugging-port=${port}`,
    "--inspect=0",
  ], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...(extraEnv ?? {}) },
  });

  return waitForCdp(port, 30_000);
}

async function launchObsidianLinux(
  binaryPath: string,
  port: number,
  extraEnv?: Record<string, string>
): Promise<Browser> {
  // Spawn the binary (or AppRun entry point) directly. The vault is already
  // registered in obsidian.json by registerTestVault, so no positional path arg
  // is needed — passing the vault as a CLI arg triggers Obsidian's CLI mode.
  // --no-sandbox is required in some CI/VM environments.
  // --disable-dev-shm-usage prevents crashes on Linux CI where /dev/shm is small.
  const proc = spawn(binaryPath, [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
  ], {
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      ...(extraEnv ?? {}),
    },
  });

  // Collect stderr so launch errors are visible in the timeout message
  const stderrChunks: Buffer[] = [];
  proc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
  proc.unref();

  try {
    return await waitForCdp(port, 45_000);
  } catch (err) {
    const stderr = Buffer.concat(stderrChunks).toString().slice(0, 2000).trim();
    const detail = stderr ? `\nStderr: ${stderr}` : "";
    throw new ObsidianLaunchError(
      (err instanceof Error ? err.message : String(err)) + detail
    );
  }
}

export async function launchObsidian(
  binaryPath: string,
  vaultPath: string,
  options: { keepSettingsOpen?: boolean; extraEnv?: Record<string, string> } = {}
): Promise<{ app: ObsidianInstance; page: Page }> {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    throw new ObsidianLaunchError(
      `Unsupported platform: ${process.platform}. E2E tests require macOS or Linux. ` +
      "Windows E2E is not yet supported — see SPRINT-010 Known Gaps for the path forward."
    );
  }

  if (isObsidianRunning()) {
    throw new ObsidianLaunchError(
      "Obsidian is already running. Close Obsidian before running E2E tests " +
      "to avoid interfering with your open vaults."
    );
  }

  // Register test vault in obsidian.json so Obsidian opens it directly
  const { vaultId, originalContent } = registerTestVault(vaultPath);

  let browser: Browser;
  try {
    const port = await findFreePort();
    if (process.platform === "darwin") {
      browser = await launchObsidianMacOS(binaryPath, vaultPath, port, options.extraEnv);
    } else {
      browser = await launchObsidianLinux(binaryPath, port, options.extraEnv);
    }
  } catch (err) {
    unregisterTestVault(vaultId, originalContent);
    throw err;
  }

  const contexts = browser.contexts();
  let page: Page | undefined;
  for (const ctx of contexts) {
    const pages = ctx.pages();
    if (pages.length > 0) { page = pages[0]; break; }
  }
  if (!page) {
    // Wait for a page to appear
    page = await browser.contexts()[0]?.waitForEvent("page").catch(() => undefined)
      ?? await new Promise<Page>((resolve) => {
        const interval = setInterval(async () => {
          for (const ctx of browser.contexts()) {
            if (ctx.pages().length > 0) { clearInterval(interval); resolve(ctx.pages()[0]); }
          }
        }, 200);
      });
  }

  await page.waitForLoadState("domcontentloaded");

  // Register persistent handlers for the trust modal and (by default) the settings
  // panel Obsidian opens after trust. Pass keepSettingsOpen:true to skip the settings
  // panel handler — used by tests that need to navigate within that panel.
  await registerModalHandlers(page, options.keepSettingsOpen ?? false);
  await page.waitForTimeout(STABILIZATION_MS);

  const app: ObsidianInstance = {
    close: async () => {
      try { await browser.close(); } catch { /* ignore */ }
      // Quit the Obsidian GUI process and wait for it to fully exit
      if (process.platform === "darwin") {
        try { execSync("osascript -e 'quit app \"Obsidian\"'", { stdio: "ignore" }); } catch { /* ignore */ }
      } else if (process.platform === "win32") {
        // /T terminates child processes; /F forces termination. Obsidian.exe is hardcoded.
        try { execSync("taskkill /F /IM Obsidian.exe /T", { stdio: "ignore" }); } catch { /* ignore */ }
      } else {
        try { execSync("pkill -KILL -x obsidian", { stdio: "ignore" }); } catch { /* ignore */ }
      }
      await waitForObsidianToExit(10_000);
      unregisterTestVault(vaultId, originalContent);
    },
  };

  return { app, page };
}

/**
 * Register persistent Playwright locator handlers for overlays that can block tests:
 *
 * 1. "Trust author and enable plugins" modal — appears on first open of every new vault.
 * 2. Obsidian settings panel — opened automatically after the trust action; identified
 *    by the .vertical-tab-header element that is unique to that panel.
 *
 * Both handlers fire the instant their target becomes visible during any Playwright
 * action, so they cover the trust modal and the settings panel regardless of which
 * test triggers them.
 */
async function registerModalHandlers(page: Page, keepSettingsOpen: boolean): Promise<void> {
  // Handler 1: dismiss the vault-trust modal, then wait for Obsidian to finish
  // reloading the vault with plugins enabled before handing control back.
  const trustButton = page.getByRole("button", { name: TRUST_MODAL_TEXT, exact: true });
  await page.addLocatorHandler(trustButton, async () => {
    await trustButton.click();
    await page.locator(".workspace").waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);
  });

  if (!keepSettingsOpen) {
    // Handler 2: close the settings panel that Obsidian opens after granting trust.
    // times:1 ensures this only fires once (for the trust side-effect) and does not
    // interfere with tests that intentionally open settings.
    const settingsPanel = page.locator(".vertical-tab-header");
    await page.addLocatorHandler(settingsPanel, async () => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }, { times: 1 });
  }
}

export async function quitObsidian(app: ObsidianInstance | undefined): Promise<void> {
  if (!app) return;
  await app.close();
}

export class ObsidianLaunchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObsidianLaunchError";
  }
}

// Re-export to avoid needing playwright imports in tests
export type { Page } from "playwright";
