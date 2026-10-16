/**
 * plugin-load.e2e.test.ts
 *
 * Verifies that the Polyphon plugin loads without errors in a real Obsidian instance.
 * Skips gracefully when Obsidian binary is not found.
 */
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import type { Page } from "playwright";
import { findObsidianBinary } from "./helpers/obsidianBinary";
import { createTestVault, type TestVault } from "./helpers/vaultFactory";
import { launchObsidian, quitObsidian, type ObsidianInstance } from "./helpers/electronHarness";
import { WORKSPACE_CONTAINER } from "./helpers/selectors";

const PLUGIN_ID = "polyphon";
const binary = findObsidianBinary();

describe.skipIf(!binary)("plugin-load", () => {
  let vault: TestVault;
  let app: ObsidianInstance;
  let page: Page;
  const consoleErrors: string[] = [];

  beforeAll(async () => {
    vault = await createTestVault();
    ({ app, page } = await launchObsidian(binary!, vault.vaultPath));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
  });

  afterEach(async (ctx) => {
    if (ctx.task.result?.state === "fail" && page) {
      const dir = path.join(__dirname, "artifacts");
      fs.mkdirSync(dir, { recursive: true });
      const name = ctx.task.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await page.screenshot({ path: path.join(dir, `fail-plugin-load-${name}.png`) }).catch(() => undefined);
    }
  });

  afterAll(async () => {
    await quitObsidian(app);
    await vault?.cleanup();
  });

  it("Obsidian window loads and workspace is present", async () => {
    await page.waitForSelector(WORKSPACE_CONTAINER, { timeout: 30_000 });
    await page.locator(WORKSPACE_CONTAINER).waitFor({ state: "visible" });
  });

  it("no plugin-crash error modal appears", async () => {
    await page.waitForTimeout(3000);
    const modals = page.locator(".modal-bg");
    const count = await modals.count();
    for (let i = 0; i < count; i++) {
      const text = await modals.nth(i).textContent();
      expect(text ?? "").not.toMatch(/polyphon|error loading/i);
    }
  });

  it("plugin id is listed in vault community-plugins.json", () => {
    const pluginsFile = path.join(vault.vaultPath, ".obsidian", "community-plugins.json");
    const plugins = JSON.parse(fs.readFileSync(pluginsFile, "utf8")) as string[];
    expect(plugins).toContain(PLUGIN_ID);
  });

  it("no error-level console messages reference the plugin", () => {
    const pluginErrors = consoleErrors.filter((msg) => /polyphon/i.test(msg));
    expect(pluginErrors).toEqual([]);
  });
});
