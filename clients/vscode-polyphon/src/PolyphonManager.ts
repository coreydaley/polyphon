import { EventEmitter } from "events";
import * as vscode from "vscode";
import { PolyphonClient, RpcError, readLocalToken } from "@polyphon-ai/js";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export class PolyphonManager extends EventEmitter implements vscode.Disposable {
  private _client: PolyphonClient;
  private _state: ConnectionState = "disconnected";
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _suppressDisconnect = false;
  private static readonly RECONNECT_INTERVAL_MS = 5000;

  constructor(context: vscode.ExtensionContext) {
    super();
    this._client = this._createClient();

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("polyphon")) {
          this._recreateClient();
        }
      }),
    );
  }

  get client(): PolyphonClient {
    return this._client;
  }

  get state(): ConnectionState {
    return this._state;
  }

  private _getConfig(): { host: string; port: number; token: string } {
    const cfg = vscode.workspace.getConfiguration("polyphon");
    return {
      host: cfg.get<string>("host", "127.0.0.1"),
      port: cfg.get<number>("port", 7432),
      token: cfg.get<string>("token", ""),
    };
  }

  private _createClient(): PolyphonClient {
    const client = new PolyphonClient(this._getConfig());
    client.on("disconnect", () => {
      if (this._suppressDisconnect) {
        this._suppressDisconnect = false;
        return;
      }
      this._setState("disconnected");
      this._scheduleReconnect();
    });
    client.on("error", () => {
      // Socket error — suppress the subsequent disconnect event and schedule reconnect
      this._suppressDisconnect = true;
      this._setState("disconnected");
      this._scheduleReconnect();
    });
    return client;
  }

  private _recreateClient(): void {
    this._clearReconnectTimer();
    this._client.disconnect();
    this._client = this._createClient();
    this.emit("clientReplaced");
    void this.connect();
  }

  async connect(): Promise<void> {
    this._clearReconnectTimer();
    this._setState("connecting");
    try {
      await this._client.connect();
      this._setState("connected");
    } catch (err: unknown) {
      const code = err instanceof RpcError ? err.code : undefined;
      const msg = err instanceof Error ? err.message : "";
      if (code === -32001 || msg.includes("Unauthorized")) {
        this._suppressDisconnect = true;
        this._setState("error");
        void vscode.window.showErrorMessage(
          "Polyphon: invalid API token. Use the 'Polyphon: Read Local API Token' command.",
        );
      } else {
        // Connection failure — the socket error/disconnect events will schedule reconnect
        this._setState("disconnected");
      }
    }
  }

  disconnect(): void {
    this._clearReconnectTimer();
    this._suppressDisconnect = true;
    this._client.disconnect();
    this._setState("disconnected");
  }

  async readAndSaveToken(): Promise<void> {
    try {
      const token = readLocalToken();
      const cfg = vscode.workspace.getConfiguration("polyphon");
      await cfg.update("token", token, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage("Polyphon: API token read successfully.");
    } catch {
      void vscode.window.showErrorMessage(
        "Polyphon: could not read local token. Is Polyphon installed and running?",
      );
    }
  }

  private _setState(state: ConnectionState): void {
    this._state = state;
    this.emit("stateChange", state);
  }

  private _scheduleReconnect(): void {
    this._clearReconnectTimer();
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      void this.connect();
    }, PolyphonManager.RECONNECT_INTERVAL_MS);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  dispose(): void {
    this._clearReconnectTimer();
    this._client.disconnect();
  }
}
