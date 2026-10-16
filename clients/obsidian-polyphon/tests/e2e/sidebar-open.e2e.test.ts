/**
 * sidebar-open.e2e.test.ts
 *
 * Verifies that the Polyphon sidebar opens and shows the disconnected state
 * (since no real Polyphon instance is running during e2e tests).
 */
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import type { Page } from "playwright";
import { findObsidianBinary } from "./helpers/obsidianBinary";
import { createTestVault, type TestVault } from "./helpers/vaultFactory";
import { launchObsidian, quitObsidian, type ObsidianInstance } from "./helpers/electronHarness";
import {
  WORKSPACE_CONTAINER,
  RIBBON_OPEN_POLYPHON,
  SIDEBAR_ROOT,
  STATUS_BAR,
} from "./helpers/selectors";

const binary = findObsidianBinary();

describe.skipIf(!binary)("sidebar-open", () => {
  let vault: TestVault;
  let app: ObsidianInstance;
  let page: Page;

  beforeAll(async () => {
    vault = await createTestVault();
    ({ app, page } = await launchObsidian(binary!, vault.vaultPath));
    await page.waitForSelector(WORKSPACE_CONTAINER, { timeout: 30_000 });
  });

  afterEach(async (ctx) => {
    if (ctx.task.result?.state === "fail" && page) {
      const dir = path.join(__dirname, "artifacts");
      fs.mkdirSync(dir, { recursive: true });
      const name = ctx.task.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await page.screenshot({ path: path.join(dir, `fail-sidebar-${name}.png`) }).catch(() => undefined);
    }
  });

  afterAll(async () => {
    await quitObsidian(app);
    await vault?.cleanup();
  });

  it("ribbon icon opens the Polyphon sidebar", async () => {
    const ribbon = page.locator(RIBBON_OPEN_POLYPHON);
    await ribbon.waitFor({ state: "visible", timeout: 15_000 });
    await ribbon.click();
    await page.locator(SIDEBAR_ROOT).waitFor({ state: "visible", timeout: 10_000 });
  });

  it("sidebar shows a status bar", async () => {
    const status = page.locator(STATUS_BAR);
    await status.waitFor({ state: "visible", timeout: 5_000 });
    expect(await status.count()).toBe(1);
  });

  it("sidebar shows connection error when Polyphon is not running", async () => {
    // No Polyphon instance → should show error/disconnected status after attempt
    await page.waitForTimeout(5_000);
    const errorStatus = page.locator(".polyphon-status-bar--error, .polyphon-status-bar--disconnected");
    await errorStatus.waitFor({ state: "visible", timeout: 10_000 });
  });

  it("command palette 'Polyphon: Open sidebar' opens the sidebar", async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.keyboard.press("ControlOrMeta+p");
    const input = page.locator('input[placeholder*="command"], .prompt-input');
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill("Polyphon: Open sidebar");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.locator(SIDEBAR_ROOT).waitFor({ state: "visible", timeout: 10_000 });
  });
});
