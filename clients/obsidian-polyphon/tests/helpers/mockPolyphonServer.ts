/**
 * mockPolyphonServer.ts — Lightweight mock TCP server that speaks the Polyphon JSON-RPC protocol.
 *
 * Binds to 127.0.0.1 on a random available port.
 * Handles: api.authenticate, compositions.list, sessions.create, sessions.get,
 *          sessions.list, sessions.messages, sessions.export, voice.broadcast,
 *          settings.getUserProfile, mcp.getStatus, api.getStatus
 *
 * voice.broadcast optionally streams stream.chunk notifications before returning.
 */
import * as net from "net";

export interface MockComposition {
  id: string;
  name: string;
  mode: "broadcast" | "conductor";
  voices: Array<{
    id: string;
    displayName: string;
    color: string;
    avatarIcon: string;
  }>;
}

export interface MockSession {
  id: string;
  compositionId: string;
  name: string;
  mode: "broadcast" | "conductor";
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  workingDir: string | null;
  sandboxedToWorkingDir: boolean;
}

export interface MockServer {
  port: number;
  token: string;
  requestCount(method: string): number;
  setCompositions(compositions: MockComposition[]): void;
  setSessions(sessions: MockSession[]): void;
  setBroadcastChunks(chunks: Array<{ voiceId: string; voiceName: string; delta: string }>[]): void;
  close(): Promise<void>;
}

export async function startMockPolyphonServer(opts: {
  token?: string;
  compositions?: MockComposition[];
} = {}): Promise<MockServer> {
  const token = opts.token ?? "mock-token-1234";
  const counts: Record<string, number> = {};

  let compositions: MockComposition[] = opts.compositions ?? [
    {
      id: "comp-1",
      name: "Test Composition",
      mode: "broadcast",
      voices: [
        { id: "voice-1", displayName: "Anthropic", color: "#D4763B", avatarIcon: "anthropic" },
        { id: "voice-2", displayName: "OpenAI", color: "#10A37F", avatarIcon: "openai" },
      ],
    },
  ];

  let sessions: MockSession[] = [];

  // Per-call broadcast chunks: array of chunk sets, one set per broadcast call
  let broadcastChunkSets: Array<Array<{ voiceId: string; voiceName: string; delta: string }>> = [];
  let broadcastCallIndex = 0;

  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let authenticated = false;
    let buf = "";

    socket.setEncoding("utf-8");
    socket.on("data", (chunk: string) => {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (!line.trim()) continue;

        let req: any;
        try { req = JSON.parse(line); } catch { continue; }

        const id = req.id ?? 0;
        counts[req.method] = (counts[req.method] ?? 0) + 1;

        const send = (result: unknown) => {
          if (!socket.destroyed) {
            socket.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
          }
        };
        const sendError = (code: number, message: string) => {
          if (!socket.destroyed) {
            socket.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
          }
        };

        if (!authenticated) {
          if (req.method !== "api.authenticate") {
            return sendError(-32001, "Authentication required");
          }
          if (req.params?.token !== token) {
            return sendError(-32001, "Invalid token");
          }
          authenticated = true;
          return send({ ok: true });
        }

        switch (req.method) {
          case "compositions.list":
            send(compositions);
            break;

          case "compositions.get": {
            const comp = compositions.find((c) => c.id === req.params?.id);
            comp ? send(comp) : sendError(-32002, "Not found");
            break;
          }

          case "sessions.create": {
            const compId = req.params?.compositionId;
            const comp = compositions.find((c) => c.id === compId);
            if (!comp) { sendError(-32002, "Composition not found"); break; }
            const now = Date.now();
            const session: MockSession = {
              id: `session-${now}`,
              compositionId: compId,
              name: req.params?.name ?? `Session ${new Date(now).toLocaleDateString()}`,
              mode: comp.mode,
              createdAt: now,
              updatedAt: now,
              archived: false,
              workingDir: req.params?.workingDir ?? null,
              sandboxedToWorkingDir: false,
            };
            sessions.push(session);
            send(session);
            break;
          }

          case "sessions.list":
            send(sessions.filter((s) => !s.archived));
            break;

          case "sessions.get": {
            const s = sessions.find((s) => s.id === req.params?.id);
            s ? send(s) : sendError(-32002, "Session not found");
            break;
          }

          case "sessions.messages":
            send([]);
            break;

          case "sessions.rename": {
            const s = sessions.find((s) => s.id === req.params?.id);
            if (!s) { sendError(-32002, "Session not found"); break; }
            s.name = req.params?.name ?? s.name;
            send(s);
            break;
          }

          case "sessions.export":
            send({ content: "# Exported session", format: req.params?.format ?? "markdown" });
            break;

          case "voice.broadcast": {
            const requestId = req.params?._requestId ?? id;
            const sessionId = req.params?.sessionId;
            const session = sessions.find((s) => s.id === sessionId);
            const comp = session ? compositions.find((c) => c.id === session.compositionId) : null;

            // Send stream chunks if configured
            const chunkSet = broadcastChunkSets[broadcastCallIndex] ?? [];
            broadcastCallIndex++;

            for (const chunk of chunkSet) {
              if (!socket.destroyed) {
                socket.write(JSON.stringify({
                  jsonrpc: "2.0",
                  method: "stream.chunk",
                  params: { requestId, voiceId: chunk.voiceId, voiceName: chunk.voiceName, delta: chunk.delta },
                }) + "\n");
              }
            }

            const voices = comp?.voices ?? [];
            const messages = voices.map((v) => ({
              id: `msg-${Date.now()}-${v.id}`,
              sessionId: sessionId ?? "unknown",
              role: "voice",
              voiceId: v.id,
              voiceName: v.displayName,
              content: chunkSet.filter((c) => c.voiceId === v.id).map((c) => c.delta).join("") || "Mock response",
              timestamp: Date.now(),
              roundIndex: 0,
            }));

            send({ messages });
            break;
          }

          case "settings.getUserProfile":
            send({
              conductorName: "Test User",
              conductorColor: "#6b7280",
              conductorAvatar: "",
              pronouns: "",
            });
            break;

          case "mcp.getStatus":
            send({ enabled: false, running: false, headless: false, transport: "stdio" });
            break;

          case "api.getStatus":
            send({
              enabled: true, remoteAccessEnabled: false, running: true,
              port: (server.address() as net.AddressInfo).port,
              host: "127.0.0.1", tokenFingerprint: token.slice(-8),
              version: "0.0.0-test", activeConnections: 1,
            });
            break;

          default:
            sendError(-32601, `Method not found: ${req.method}`);
        }
      }
    });

    socket.on("error", () => { /* ignore client disconnect errors */ });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const addr = server.address() as net.AddressInfo;

  return {
    port: addr.port,
    token,
    requestCount: (method: string) => counts[method] ?? 0,
    setCompositions: (c) => { compositions = c; },
    setSessions: (s) => { sessions = s; },
    setBroadcastChunks: (chunks) => {
      broadcastChunkSets = chunks;
      broadcastCallIndex = 0;
    },
    close: () => new Promise<void>((resolve, reject) => {
      for (const s of sockets) s.destroy();
      sockets.clear();
      server.close((err) => err ? reject(err) : resolve());
    }),
  };
}
