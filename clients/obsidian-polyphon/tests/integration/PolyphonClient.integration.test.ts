import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PolyphonClient, RpcError } from "@polyphon-ai/js";
import { MockPolyphonServer } from "@polyphon-ai/js/testing";

describe("PolyphonClient integration", () => {
  let server: MockPolyphonServer;
  let client: PolyphonClient;

  beforeEach(async () => {
    server = new MockPolyphonServer({ token: "test-token" });
    await server.start();
    client = new PolyphonClient({ host: "127.0.0.1", port: server.port, token: "test-token" });
  });

  afterEach(async () => {
    client.disconnect();
    await server.stop();
  });

  // ---- connect / auth -------------------------------------------------------

  it("connects and authenticates successfully", async () => {
    await expect(client.connect()).resolves.toBeUndefined();
    expect(client.getState()).toBe("connected");
  });

  it("rejects connection with wrong token as RpcError", async () => {
    const bad = new PolyphonClient({ host: "127.0.0.1", port: server.port, token: "wrong" });
    await expect(bad.connect()).rejects.toBeInstanceOf(RpcError);
    bad.disconnect();
  });

  it("state is disconnected after disconnect()", async () => {
    await client.connect();
    const disconnected = new Promise<void>((resolve) => client.once("disconnect", resolve));
    client.disconnect();
    await disconnected;
    expect(client.getState()).toBe("disconnected");
  });

  // ---- sessions.create -------------------------------------------------------

  it("createSession sends the given source and extra fields", async () => {
    await client.connect();
    await client.createSession("comp-default", "obsidian", { name: "Test" });
    const calls = server.calls("sessions.create");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ source: "obsidian", name: "Test", compositionId: "comp-default" });
  });

  // ---- compositions.list -------------------------------------------------------

  it("compositions() returns raw compositions from server", async () => {
    await client.connect();
    const comps = await client.compositions();
    expect(comps.length).toBeGreaterThan(0);
    expect(comps[0].voices.length).toBeGreaterThan(0);
    // side assignment is plugin-layer logic done in PolyphonSidebarView, not the SDK
  });

  // ---- sessions.list ----------------------------------------------------------

  it("sessions() returns all sessions (filtering is plugin-layer)", async () => {
    await client.connect();
    // create two sessions for different compositions so we have data to filter
    await client.createSession("comp-default", "obsidian", { name: "S1" });
    server.clearCalls();

    const all = await client.sessions();
    expect(all.length).toBeGreaterThanOrEqual(1);

    // plugin-layer filtering pattern used in PolyphonSidebarView.loadSessions()
    const filtered = all.filter((s) => s.compositionId === "comp-default");
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });

  // ---- voice.broadcast -------------------------------------------------------

  it("broadcast delivers result messages", async () => {
    await client.connect();
    const sessions = await client.sessions();
    const sessionId = sessions[0]?.id ?? "session-default";

    const result = await client.broadcast({ sessionId, content: "hi" });
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("broadcast delivers stream chunks via onChunk callback", async () => {
    await client.connect();
    const sessions = await client.sessions();
    const sessionId = sessions[0]?.id ?? "session-default";

    const chunks: string[] = [];
    await client.broadcast(
      { sessionId, content: "hi" },
      (chunk) => chunks.push(chunk.delta),
    );
    expect(chunks.length).toBeGreaterThan(0);
  });

  // ---- error handling -----------------------------------------------------------

  it("rejects with RpcError on unknown method", async () => {
    await client.connect();
    await expect((client as any).call("nonexistent.method")).rejects.toBeInstanceOf(RpcError);
  });

  it("rejects with RpcError when server simulates an error", async () => {
    await client.connect();
    server.simulateError("compositions.list", -32000, "something went wrong");
    await expect(client.compositions()).rejects.toBeInstanceOf(RpcError);
  });
});
