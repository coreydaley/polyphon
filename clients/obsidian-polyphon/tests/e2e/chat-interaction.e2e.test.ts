/**
 * chat-interaction.e2e.test.ts
 *
 * End-to-end tests for the Polyphon plugin chat UI using a mock TCP server.
 *
 * Strategy:
 * - A mock Polyphon TCP server is started before Obsidian launches.
 * - Vault data.json is pre-seeded with host/port/token pointing at the mock server.
 * - Tests open the sidebar, select a composition, create a session, and send messages.
 * - The mock server responds with canned stream.chunk notifications and final messages.
 */
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import type { Page } from "playwright";
import { findObsidianBinary } from "./helpers/obsidianBinary";
import { createTestVault, type TestVault } from "./helpers/vaultFactory";
import { launchObsidian, quitObsidian, type ObsidianInstance } from "./helpers/electronHarness";
import { startMockPolyphonServer, type MockServer } from "../helpers/mockPolyphonServer";
import {
  WORKSPACE_CONTAINER,
  RIBBON_OPEN_POLYPHON,
  SIDEBAR_ROOT,
  STATUS_CONNECTED,
  COMPOSITION_SELECT,
  SESSION_ROW,
  SESSION_NEW_BTN,
  CHAT_INPUT,
  SEND_BTN,
  MSG_USER,
  MSG_VOICE,
  MENTION_DROPDOWN,
  MENTION_ITEM,
} from "./helpers/selectors";

const binary = findObsidianBinary();
const MOCK_RESPONSE = "Hello from mock Polyphon";

async function openSidebar(page: Page): Promise<void> {
  const ribbon = page.locator(RIBBON_OPEN_POLYPHON);
  await ribbon.waitFor({ state: "visible", timeout: 15_000 });
  await ribbon.click();
  await page.locator(SIDEBAR_ROOT).waitFor({ state: "visible", timeout: 10_000 });
}

async function waitForConnected(page: Page): Promise<void> {
  await page.locator(STATUS_CONNECTED).waitFor({ state: "visible", timeout: 15_000 });
}

async function selectComposition(page: Page): Promise<void> {
  const select = page.locator(COMPOSITION_SELECT);
  await select.waitFor({ state: "visible", timeout: 5_000 });
  await select.selectOption({ index: 1 }); // first real option (index 0 is placeholder)
  await page.locator(SESSION_ROW).waitFor({ state: "visible", timeout: 5_000 });
}

async function startNewSession(page: Page): Promise<void> {
  await page.locator(SESSION_NEW_BTN).click();
}

async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.locator(CHAT_INPUT);
  await input.waitFor({ state: "visible" });
  await input.click();
  await input.fill(text);
  await page.keyboard.press("Enter");
}

describe.skipIf(!binary)("chat-interaction", () => {
  let mockServer: MockServer;
  let vault: TestVault;
  let app: ObsidianInstance;
  let page: Page;

  beforeAll(async () => {
    mockServer = await startMockPolyphonServer();

    vault = await createTestVault({
      host: "127.0.0.1",
      port: mockServer.port,
      token: mockServer.token,
    });

    try {
      ({ app, page } = await launchObsidian(binary!, vault.vaultPath));
    } catch (err) {
      await mockServer.close().catch(() => undefined);
      throw err;
    }

    await page.waitForSelector(WORKSPACE_CONTAINER, { timeout: 30_000 });
    await openSidebar(page);
    await waitForConnected(page);
    await selectComposition(page);
    await startNewSession(page);
  });

  afterEach(async (ctx) => {
    if (ctx.task.result?.state === "fail" && page) {
      const dir = path.join(__dirname, "artifacts");
      fs.mkdirSync(dir, { recursive: true });
      const name = ctx.task.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await page.screenshot({ path: path.join(dir, `fail-chat-${name}.png`) }).catch(() => undefined);
    }
    mockServer.setBroadcastChunks([]);
  });

  afterAll(async () => {
    await quitObsidian(app);
    await vault?.cleanup();
    await mockServer?.close().catch(() => undefined);
  });

  it("connects to mock server and shows connected status", async () => {
    const status = page.locator(STATUS_CONNECTED);
    await status.waitFor({ state: "visible", timeout: 5_000 });
  });

  it("composition select is populated from mock server", async () => {
    const select = page.locator(COMPOSITION_SELECT);
    const options = await select.locator("option").all();
    // First is placeholder, second is the mock composition
    expect(options.length).toBeGreaterThanOrEqual(2);
    const text = await options[1].textContent();
    expect(text).toContain("Test Composition");
  });

  it("send button is enabled after session is created", async () => {
    const btn = page.locator(SEND_BTN);
    expect(await btn.isDisabled()).toBe(false);
  });

  it("sends a message and shows user bubble", async () => {
    await sendMessage(page, "Hello test");
    await page.locator(MSG_USER).waitFor({ state: "visible", timeout: 10_000 });
    const text = await page.locator(MSG_USER).last().textContent();
    expect(text).toContain("Hello test");
    expect(mockServer.requestCount("voice.broadcast")).toBeGreaterThan(0);
  });

  it("shows voice response bubbles after broadcast", async () => {
    mockServer.setBroadcastChunks([[
      { voiceId: "voice-1", voiceName: "Anthropic", delta: MOCK_RESPONSE },
    ]]);

    await sendMessage(page, "Another message");
    await page.locator(MSG_VOICE).last().waitFor({ state: "visible", timeout: 15_000 });
  });

  it("conductor typing indicator appears while typing", async () => {
    const input = page.locator(CHAT_INPUT);
    await input.click();
    await input.fill("typing...");
    // Typing indicator should appear
    const indicator = page.locator("[data-conductor-typing]");
    await indicator.waitFor({ state: "visible", timeout: 3_000 });
    // Clear input — indicator should disappear
    await input.fill("");
    await indicator.waitFor({ state: "hidden", timeout: 3_000 });
  });

  it("@ shows mention dropdown", async () => {
    const input = page.locator(CHAT_INPUT);
    await input.click();
    await input.fill("@");
    const dropdown = page.locator(MENTION_DROPDOWN);
    await dropdown.waitFor({ state: "visible", timeout: 3_000 });
    const items = page.locator(MENTION_ITEM);
    expect(await items.count()).toBeGreaterThan(0);
  });

  it("selecting a mention inserts @VoiceName into input", async () => {
    const input = page.locator(CHAT_INPUT);
    await input.click();
    await input.fill("@Anth");
    const dropdown = page.locator(MENTION_DROPDOWN);
    await dropdown.waitFor({ state: "visible", timeout: 3_000 });
    await page.locator(MENTION_ITEM).first().click();
    const value = await input.inputValue();
    expect(value).toContain("@Anthropic");
  });

  it("New button creates a new session", async () => {
    const initialBroadcastCount = mockServer.requestCount("sessions.create");
    await page.locator(SESSION_NEW_BTN).click();
    // Wait for session create to be called
    await page.waitForTimeout(1_000);
    expect(mockServer.requestCount("sessions.create")).toBeGreaterThan(initialBroadcastCount);
  });
});
