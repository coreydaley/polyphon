import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockPolyphonServer } from "@polyphon-ai/js/testing";

// vscode mock — hoisted before PolyphonManager import
let mockCfg = { host: "127.0.0.1", port: 7432, token: "test-token" };
let capturedConfigHandler: ((e: { affectsConfiguration: (s: string) => boolean }) => void) | null =
  null;

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, def?: unknown) => (mockCfg as Record<string, unknown>)[key] ?? def),
      update: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn((handler) => {
      capturedConfigHandler = handler;
      return { dispose: vi.fn() };
    }),
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  ConfigurationTarget: { Global: 1 },
}));

import * as vscode from "vscode";
import { PolyphonManager } from "./PolyphonManager";

function makeContext() {
  return { subscriptions: [] } as unknown as import("vscode").ExtensionContext;
}

describe("PolyphonManager", () => {
  let server: MockPolyphonServer;
  let manager: PolyphonManager;

  beforeEach(async () => {
    server = new MockPolyphonServer({ token: "test-token", streamingDelayMs: 0 });
    await server.start();
    mockCfg = { host: "127.0.0.1", port: server.port, token: "test-token" };
    capturedConfigHandler = null;
    vi.clearAllMocks();
    manager = new PolyphonManager(makeContext());
  });

  afterEach(async () => {
    manager.dispose();
    await server.stop();
  });

  // ---- initial state ----

  it("starts in the disconnected state", () => {
    expect(manager.state).toBe("disconnected");
  });

  // ---- connect() ----

  it("transitions to connected after a successful connect", async () => {
    await manager.connect();
    expect(manager.state).toBe("connected");
  });

  it("emits connecting then connected on successful connect", async () => {
    const states: string[] = [];
    manager.on("stateChange", (s: string) => states.push(s));
    await manager.connect();
    expect(states).toEqual(["connecting", "connected"]);
  });

  it("authenticates with the configured token", async () => {
    await manager.connect();
    const calls = server.calls("api.authenticate");
    expect(calls.length).toBe(1);
    expect(calls[0]).toMatchObject({ token: "test-token" });
  });

  it("transitions to error state on auth failure and shows an error message", async () => {
    server.simulateError("api.authenticate", -32001, "Unauthorized");
    await manager.connect();
    expect(manager.state).toBe("error");
    expect(vi.mocked(vscode.window.showErrorMessage)).toHaveBeenCalledWith(
      expect.stringContaining("invalid API token"),
    );
  });

  it("transitions to disconnected when the server is not reachable", async () => {
    // Create a manager pointing at a closed port
    const deadServer = new MockPolyphonServer();
    await deadServer.start();
    const deadPort = deadServer.port;
    await deadServer.stop();

    manager.dispose();
    mockCfg = { ...mockCfg, port: deadPort };
    manager = new PolyphonManager(makeContext());

    await manager.connect();
    expect(manager.state).toBe("disconnected");
  });

  // ---- disconnect() ----

  it("transitions to disconnected on manual disconnect", async () => {
    await manager.connect();
    manager.disconnect();
    expect(manager.state).toBe("disconnected");
  });

  it("does not schedule a reconnect after manual disconnect", async () => {
    await manager.connect();
    const connectSpy = vi.spyOn(manager, "connect").mockResolvedValue();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    manager.disconnect();
    vi.advanceTimersByTime(6000);
    vi.useRealTimers();

    expect(connectSpy).not.toHaveBeenCalled();
  });

  // ---- reconnect on unexpected disconnect ----

  it("transitions to disconnected when the server drops the connection", async () => {
    await manager.connect();
    const disconnected = new Promise<void>((resolve) => {
      manager.once("stateChange", (s: string) => {
        if (s === "disconnected") resolve();
      });
    });
    manager.client.emit("disconnect");
    await disconnected;
    expect(manager.state).toBe("disconnected");
  });

  it("schedules a reconnect after an unexpected disconnect", async () => {
    await manager.connect();
    const connectSpy = vi.spyOn(manager, "connect").mockResolvedValue();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    manager.client.emit("disconnect"); // simulate server-side drop
    vi.advanceTimersByTime(5001);
    vi.useRealTimers();

    expect(connectSpy).toHaveBeenCalled();
  });

  it("transitions to disconnected on socket error and schedules reconnect", async () => {
    await manager.connect();
    const connectSpy = vi.spyOn(manager, "connect").mockResolvedValue();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    manager.client.emit("error", new Error("ECONNRESET"));
    vi.advanceTimersByTime(5001);
    vi.useRealTimers();

    expect(manager.state).toBe("disconnected");
    expect(connectSpy).toHaveBeenCalled();
  });

  it("does not double-reconnect when error is followed by disconnect", async () => {
    await manager.connect();
    const connectSpy = vi.spyOn(manager, "connect").mockResolvedValue();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    manager.client.emit("error", new Error("ECONNRESET"));
    manager.client.emit("disconnect"); // normally suppressed after error
    vi.advanceTimersByTime(5001);
    vi.useRealTimers();

    // Only one reconnect timer should have fired
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  // ---- clientReplaced on config change ----

  it("emits clientReplaced when polyphon configuration changes", async () => {
    await manager.connect();
    const replaced = vi.fn();
    manager.on("clientReplaced", replaced);

    capturedConfigHandler?.({ affectsConfiguration: () => true });

    expect(replaced).toHaveBeenCalled();
  });

  it("ignores configuration changes for unrelated settings", async () => {
    await manager.connect();
    const replaced = vi.fn();
    manager.on("clientReplaced", replaced);

    capturedConfigHandler?.({ affectsConfiguration: () => false });

    expect(replaced).not.toHaveBeenCalled();
  });

  // ---- client API access ----

  it("exposes a client that can list compositions", async () => {
    await manager.connect();
    const comps = await manager.client.compositions();
    expect(Array.isArray(comps)).toBe(true);
    expect(comps.length).toBeGreaterThan(0);
  });

  it("exposes a client that can create sessions", async () => {
    await manager.connect();
    const session = await manager.client.createSession("comp-default", "vscode", {
      name: "test session",
    });
    expect(session.id).toBeDefined();
    expect(session.source).toBe("vscode");
    expect(server.calls("sessions.create").length).toBe(1);
  });

  // ---- dispose ----

  it("dispose cancels any pending reconnect timer", async () => {
    await manager.connect();
    const connectSpy = vi.spyOn(manager, "connect").mockResolvedValue();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    manager.client.emit("disconnect"); // schedules reconnect
    manager.dispose(); // should cancel it
    vi.advanceTimersByTime(6000);
    vi.useRealTimers();

    expect(connectSpy).not.toHaveBeenCalled();
  });
});
