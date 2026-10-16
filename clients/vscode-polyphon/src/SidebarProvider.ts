import * as vscode from "vscode";
import type { Composition, Session } from "@polyphon-ai/js";
import type { PolyphonManager } from "./PolyphonManager";
import { getCodeContext } from "./context";
import { parseMention } from "./webview/parseMention";

interface VoiceData {
  id: string;
  displayName: string;
  color: string;
  side: "left" | "right";
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "polyphon.sidebar";

  private _view: vscode.WebviewView | undefined;
  private readonly _manager: PolyphonManager;
  private readonly _extensionUri: vscode.Uri;

  private _compositions: Composition[] = [];
  private _activeComposition: Composition | null = null;
  private _activeSession: Session | null = null;
  private _lastSentFilePath: string | null = null;

  constructor(extensionUri: vscode.Uri, manager: PolyphonManager) {
    this._extensionUri = extensionUri;
    this._manager = manager;

    manager.on("stateChange", (state: string) => {
      this._post({ type: "state", state });
      if (state === "connected") void this._onConnected();
    });

    manager.on("clientReplaced", () => {
      this._compositions = [];
      this._activeComposition = null;
      this._activeSession = null;
    });
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg: Record<string, unknown>) => {
      void this._onMessage(msg);
    });
  }

  async newSession(): Promise<void> {
    if (!this._view) {
      await vscode.commands.executeCommand("polyphon.sidebar.focus");
    }
    if (this._activeComposition) {
      await this._createSession(this._activeComposition.id);
    } else {
      this._post({ type: "focusCompositionSelect" });
    }
  }

  async askAboutSelection(): Promise<void> {
    if (!this._view) {
      await vscode.commands.executeCommand("polyphon.sidebar.focus");
    }
    const ctx = getCodeContext();
    if (ctx.selection) {
      this._post({ type: "prefillInput", text: ctx.selection });
    }
  }

  private async _onConnected(): Promise<void> {
    const client = this._manager.client;
    const [profileResult] = await Promise.allSettled([
      client.getUserProfile(),
      this._loadCompositions(),
    ]);
    if (profileResult.status === "fulfilled") {
      const p = profileResult.value;
      this._post({ type: "profile", conductorName: p.conductorName, conductorColor: p.conductorColor });
    }
  }

  private async _loadCompositions(): Promise<void> {
    const comps = await this._manager.client.compositions();
    this._compositions = comps;
    this._post({
      type: "compositions",
      compositions: comps.map((c) => ({ id: c.id, name: c.name })),
      activeCompositionId: this._activeComposition?.id ?? null,
    });
  }

  private async _loadSessions(compositionId: string): Promise<void> {
    const all = await this._manager.client.sessions();
    const sessions = all
      .filter((s) => s.compositionId === compositionId && !s.archived && s.source === "vscode")
      .sort((a, b) => b.updatedAt - a.updatedAt);
    this._post({
      type: "sessions",
      sessions: sessions.map((s) => ({ id: s.id, name: s.name, updatedAt: s.updatedAt })),
      activeSessionId: this._activeSession?.id ?? null,
    });
  }

  private async _createSession(compositionId: string): Promise<void> {
    const workingDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const workspaceName = vscode.workspace.name ?? "VS Code";
    const name = `${workspaceName} · ${date}`;
    const session = await this._manager.client.createSession(compositionId, "vscode", {
      name,
      workingDir,
    });
    this._activeSession = session;
    this._lastSentFilePath = null;
    this._post({ type: "sessionCreated", session: { id: session.id, name: session.name } });
    await this._loadSessions(compositionId);
    const comp = this._compositions.find((c) => c.id === compositionId);
    if (comp) {
      this._post({ type: "voices", voices: this._voiceData(comp) });
    }
  }

  private async _resumeSession(sessionId: string): Promise<void> {
    const session = await this._manager.client.getSession({ id: sessionId });
    this._activeSession = session;
    this._lastSentFilePath = null;
    const comp = this._compositions.find((c) => c.id === session.compositionId);
    if (comp) {
      this._activeComposition = comp;
      this._post({ type: "voices", voices: this._voiceData(comp) });
    }
    const messages = await this._manager.client.getMessages({ sessionId });
    this._post({
      type: "messages",
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        voiceId: m.voiceId,
        voiceName: m.voiceName,
        content: m.content,
      })),
    });
  }

  private async _sendMessage(text: string, attachContext: boolean): Promise<void> {
    if (!this._activeSession) return;

    let content = text;
    const ctx = getCodeContext();
    const parts: string[] = [];
    if (ctx.file && ctx.file !== this._lastSentFilePath) {
      parts.push(`> File: ${ctx.file}`);
      this._lastSentFilePath = ctx.file;
    }
    if (attachContext) {
      if (ctx.selection) {
        parts.push(`\`\`\`\n${ctx.selection}\n\`\`\``);
      }
      if (ctx.diagnostics?.length) {
        parts.push(`> Errors:\n${ctx.diagnostics.map((d) => `> - ${d}`).join("\n")}`);
      }
    }
    if (parts.length > 0) {
      content = `${parts.join("\n")}\n\n${text}`;
    }

    // Show the user-visible text in the webview (not the prepended context)
    this._post({ type: "userMessage", content: text });
    this._post({ type: "sendEnabled", enabled: false });

    const voiceRefs = (this._activeComposition?.voices ?? []).map((v, i) => ({
      id: v.id,
      displayName: v.displayName,
      color: v.color,
      side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
    }));
    const mentionedVoice = parseMention(content, voiceRefs);
    const pendingVoices: VoiceData[] = mentionedVoice
      ? [voiceRefs.find((v) => v.id === mentionedVoice.id)!]
      : voiceRefs;

    this._post({ type: "showPending", voices: pendingVoices });

    try {
      await this._manager.client.broadcast(
        { sessionId: this._activeSession.id, content },
        (chunk) =>
          this._post({ type: "chunk", voiceId: chunk.voiceId, voiceName: chunk.voiceName, delta: chunk.delta }),
      );
    } catch {
      this._post({ type: "streamError" });
    } finally {
      this._post({ type: "streamDone" });
      this._post({ type: "sendEnabled", enabled: true });
    }
  }

  private async _onMessage(msg: Record<string, unknown>): Promise<void> {
    switch (msg.type) {
      case "ready":
        this._post({ type: "state", state: this._manager.state });
        if (this._manager.state === "connected") {
          await this._onConnected();
          if (this._activeComposition) {
            await this._loadSessions(this._activeComposition.id);
            if (this._activeSession) await this._resumeSession(this._activeSession.id);
          }
        }
        break;
      case "reconnect":
        void this._manager.connect();
        break;
      case "selectComposition": {
        const id = msg.compositionId as string;
        this._activeComposition = this._compositions.find((c) => c.id === id) ?? null;
        await this._loadSessions(id);
        break;
      }
      case "newSession":
        await this._createSession(msg.compositionId as string);
        break;
      case "selectSession":
        await this._resumeSession(msg.sessionId as string);
        break;
      case "send":
        await this._sendMessage(msg.text as string, msg.attachContext as boolean);
        break;
    }
  }

  private _voiceData(comp: Composition): VoiceData[] {
    return comp.voices.map((v, i) => ({
      id: v.id,
      displayName: v.displayName,
      color: v.color,
      side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
    }));
  }

  private _post(msg: object): void {
    void this._view?.webview.postMessage(msg);
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "style.css"),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
