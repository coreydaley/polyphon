import { ItemView, WorkspaceLeaf, Notice, sanitizeHTMLToDom, setIcon } from "obsidian";
import type PolyphonPlugin from "./main";
import { PolyphonClient, RpcError } from "@polyphon-ai/js";
import { ConversationView } from "./ConversationView";
import { parseMention } from "./parseMention";
import type { Composition, ConductorProfile, Session, ConnectionStatus, Voice } from "./types";

export const POLYPHON_SIDEBAR_VIEW_TYPE = "polyphon-sidebar";

export class PolyphonSidebarView extends ItemView {
  private plugin: PolyphonPlugin;
  private client: PolyphonClient;
  private status: ConnectionStatus = "disconnected";
  private reconnectTimer: number | null = null;
  private readonly RECONNECT_INTERVAL_MS = 5000;
  private suppressDisconnectHandler = false;

  private statusBar: HTMLElement | null = null;
  private compositionSelect: HTMLSelectElement | null = null;
  private sessionRow: HTMLElement | null = null;
  private sessionSelect: HTMLSelectElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private sessionHeaderEl: HTMLElement | null = null; // kept for compat, unused
  private voiceRosterEl: HTMLElement | null = null;
  private voiceRosterChips = new Map<string, HTMLElement>(); // voiceId → chip element
  private mentionDropdown: HTMLElement | null = null;
  private conversationView: ConversationView | null = null;

  private compositions: Composition[] = [];
  private activeComposition: Composition | null = null;
  private activeSession: Session | null = null;
  private lastSentFilePath: string | null = null;
  private conductorProfile: ConductorProfile = {
    conductorName: "You",
    conductorColor: "",
    conductorAvatar: "",
    pronouns: "",
  };

  // @mention autocomplete state
  private mentionQuery: string | null = null;
  private mentionStart = 0;
  private mentionIndex = 0;
  private mentionFiltered: Voice[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: PolyphonPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.client = plugin.client;
  }

  getViewType(): string { return POLYPHON_SIDEBAR_VIEW_TYPE; }
  getDisplayText(): string { return "Polyphon"; }
  getIcon(): string { return "message-square"; }

  async onOpen(): Promise<void> {
    this.buildLayout();

    this.client.on("disconnect", () => {
      if (this.suppressDisconnectHandler) {
        this.suppressDisconnectHandler = false;
        return;
      }
      this.setStatus("disconnected");
      this.setSendEnabled(false);
      this.scheduleReconnect();
    });

    this.client.on("error", () => {
      // Socket error (e.g. ECONNREFUSED) — suppress the subsequent "disconnect" event
      // and schedule reconnect ourselves
      this.suppressDisconnectHandler = true;
      this.setStatus("disconnected");
      this.setSendEnabled(false);
      this.scheduleReconnect();
    });

    await this.connect();
  }

  onClose(): Promise<void> {
    this.clearReconnectTimer();
    this.client.disconnect();
    document.body.querySelectorAll(".polyphon-voice-chip__tooltip").forEach(t => t.remove());
    return Promise.resolve();
  }

  onClientReplaced(client: PolyphonClient): void {
    this.client = client;
    void this.connect();
  }

  // ---- Layout ----

  private buildLayout(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("polyphon-sidebar");

    // Branding header
    const header = root.createDiv({ cls: "polyphon-header" });
    const logoEl = header.createDiv({ cls: "polyphon-header__logo" });
    logoEl.appendChild(sanitizeHTMLToDom(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 680" width="22" height="22">
      <defs><clipPath id="ph-ic"><rect x="40" y="40" width="600" height="600" rx="128"/></clipPath></defs>
      <rect x="40" y="40" width="600" height="600" rx="128" fill="#f0f0f8"/>
      <g clip-path="url(#ph-ic)">
        <path d="M 490 40 A 150 150 0 0 0 640 190" fill="none" stroke="#3730a3" stroke-width="28" stroke-linecap="round" opacity="0.95"/>
        <path d="M 370 40 A 270 270 0 0 0 640 310" fill="none" stroke="#4338ca" stroke-width="25" stroke-linecap="round" opacity="0.88"/>
        <path d="M 248 40 A 392 392 0 0 0 640 432" fill="none" stroke="#4f46e5" stroke-width="22" stroke-linecap="round" opacity="0.78"/>
        <path d="M 122 40 A 518 518 0 0 0 640 558" fill="none" stroke="#6366f1" stroke-width="19" stroke-linecap="round" opacity="0.62"/>
        <path d="M  40 118 A 522 522 0 0 0 562 640" fill="none" stroke="#818cf8" stroke-width="16" stroke-linecap="round" opacity="0.44"/>
        <path d="M  40 490 A 150 150 0 0 1 190 640" fill="none" stroke="#6d28d9" stroke-width="28" stroke-linecap="round" opacity="0.92"/>
        <path d="M  40 368 A 272 272 0 0 1 312 640" fill="none" stroke="#7c3aed" stroke-width="25" stroke-linecap="round" opacity="0.82"/>
        <path d="M  40 246 A 394 394 0 0 1 434 640" fill="none" stroke="#0891b2" stroke-width="22" stroke-linecap="round" opacity="0.72"/>
        <path d="M  40 122 A 518 518 0 0 1 558 640" fill="none" stroke="#0e7490" stroke-width="19" stroke-linecap="round" opacity="0.56"/>
      </g>
    </svg>`));
    const headerText = header.createDiv({ cls: "polyphon-header__text" });
    headerText.createSpan({ cls: "polyphon-header__wordmark", text: "Polyphon" });
    headerText.createSpan({ cls: "polyphon-header__tagline", text: "One Chat. Many Voices." });
    this.statusBar = header.createDiv({ cls: "polyphon-status-bar" });
    this.renderStatus();

    const topBar = root.createDiv({ cls: "polyphon-top-bar" });
    this.compositionSelect = topBar.createEl("select", { cls: "polyphon-select" });
    this.compositionSelect.createEl("option", { text: "— select a composition —", attr: { value: "" } });
    this.compositionSelect.addEventListener("change", () => void this.onCompositionSelected());

    this.sessionRow = root.createDiv({ cls: "polyphon-session-row polyphon-session-row--hidden" });
    this.sessionSelect = this.sessionRow.createEl("select", { cls: "polyphon-select polyphon-session-select" });
    this.sessionSelect.addEventListener("change", () => void this.onSessionSelected());
    const newBtn = this.sessionRow.createEl("button", { cls: "polyphon-btn polyphon-btn--new", text: "New" });
    newBtn.title = "Start a new session";
    newBtn.addEventListener("click", () => void this.startNewSession());

    this.voiceRosterEl = root.createDiv({ cls: "polyphon-voice-roster polyphon-voice-roster--hidden" });

    // session header removed — dropdown already shows current session

    const conversationEl = root.createDiv({ cls: "polyphon-conversation" });
    this.conversationView = new ConversationView(conversationEl);

    // Input wrapper — relative so dropdown can be positioned above it
    const inputWrapper = root.createDiv({ cls: "polyphon-input-wrapper" });

    // @mention dropdown (hidden by default, sits above textarea)
    this.mentionDropdown = inputWrapper.createDiv({ cls: "polyphon-mention-dropdown polyphon-mention-dropdown--hidden" });

    const inputArea = inputWrapper.createDiv({ cls: "polyphon-input-area" });
    this.inputEl = inputArea.createEl("textarea", {
      cls: "polyphon-input",
      attr: { placeholder: "Message all voices… (@ to target one)", rows: "3" },
    });
    this.inputEl.addEventListener("input", () => {
      this.onInputChange();
      this.onInputTyping();
    });
    this.inputEl.addEventListener("keydown", (e) => this.onInputKeyDown(e));
    this.sendBtn = inputArea.createEl("button", { cls: "polyphon-btn polyphon-btn--send", text: "Send" });
    this.sendBtn.addEventListener("click", () => void this.sendMessage());
    this.setSendEnabled(false);
  }

  // ---- @mention ----

  private onInputTyping(): void {
    if (!this.activeSession) return;
    const hasText = (this.inputEl?.value.trim().length ?? 0) > 0;
    if (hasText) {
      this.conversationView?.showConductorTyping();
    } else {
      this.conversationView?.hideConductorTyping();
    }
  }

  private onInputChange(): void {
    if (!this.inputEl) return;
    const val = this.inputEl.value;
    const cursor = this.inputEl.selectionStart ?? 0;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const query = match[1] ?? "";
      const voices = this.activeComposition?.voices ?? [];
      this.mentionQuery = query;
      this.mentionStart = cursor - match[0].length;
      this.mentionFiltered = query === ""
        ? voices
        : voices.filter((v) => v.displayName.toLowerCase().startsWith(query.toLowerCase()));
      this.mentionIndex = 0;
      this.renderMentionDropdown();
    } else {
      this.closeMentionDropdown();
    }
  }

  private onInputKeyDown(e: KeyboardEvent): void {
    // Handle dropdown navigation first
    if (this.mentionQuery !== null && this.mentionFiltered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.mentionIndex = (this.mentionIndex + 1) % this.mentionFiltered.length;
        this.renderMentionDropdown();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.mentionIndex = (this.mentionIndex - 1 + this.mentionFiltered.length) % this.mentionFiltered.length;
        this.renderMentionDropdown();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        this.insertMention(this.mentionFiltered[this.mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeMentionDropdown();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void this.sendMessage();
    }
  }

  private renderMentionDropdown(): void {
    if (!this.mentionDropdown) return;
    this.mentionDropdown.empty();

    if (this.mentionFiltered.length === 0) {
      this.closeMentionDropdown();
      return;
    }

    this.mentionDropdown.removeClass("polyphon-mention-dropdown--hidden");

    for (let i = 0; i < this.mentionFiltered.length; i++) {
      const voice = this.mentionFiltered[i];
      const item = this.mentionDropdown.createDiv({
        cls: `polyphon-mention-item${i === this.mentionIndex ? " polyphon-mention-item--active" : ""}`,
      });

      const avatar = item.createSpan({ cls: "polyphon-mention-avatar" });
      avatar.style.backgroundColor = `${voice.color}25`;
      avatar.style.color = voice.color;
      avatar.textContent = voice.displayName.charAt(0).toUpperCase();

      item.createSpan({ cls: "polyphon-mention-name", text: `@${voice.displayName}` });

      // mousedown instead of click to avoid blurring the textarea
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.insertMention(voice);
      });
    }
  }

  private insertMention(voice: Voice): void {
    if (!this.inputEl) return;
    const cursor = this.inputEl.selectionStart ?? this.mentionStart;
    const val = this.inputEl.value;
    const before = val.slice(0, this.mentionStart);
    const after = val.slice(cursor);
    const inserted = `@${voice.displayName} `;
    this.inputEl.value = before + inserted + after;
    const pos = this.mentionStart + inserted.length;
    this.inputEl.setSelectionRange(pos, pos);
    this.inputEl.focus();
    this.closeMentionDropdown();
  }

  private closeMentionDropdown(): void {
    this.mentionQuery = null;
    this.mentionFiltered = [];
    this.mentionDropdown?.addClass("polyphon-mention-dropdown--hidden");
    this.mentionDropdown?.empty();
  }

  // ---- Status ----

  private renderStatus(): void {
    if (!this.statusBar) return;
    this.statusBar.empty();
    this.statusBar.className = `polyphon-status-bar polyphon-status-bar--${this.status}`;
    const labels: Record<ConnectionStatus, string> = {
      disconnected: "offline",
      connecting: "connecting…",
      connected: "online",
      error: "auth error",
    };
    const badge = this.statusBar.createSpan({ cls: "polyphon-status-badge", text: labels[this.status] });
    if (this.status === "disconnected" || this.status === "error") {
      badge.addClass("polyphon-status-badge--clickable");
      badge.addEventListener("click", () => void this.connect());
      const connectBtn = this.statusBar.createSpan({ cls: "polyphon-connect-btn" });
      connectBtn.title = "Click to connect";
      setIcon(connectBtn, "plug-zap");
      connectBtn.addEventListener("click", () => void this.connect());
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.renderStatus();
    this.setSendEnabled(status === "connected" && this.activeSession !== null);
  }

  private setSendEnabled(enabled: boolean): void {
    if (this.sendBtn) this.sendBtn.disabled = !enabled;
    if (this.inputEl) this.inputEl.disabled = !enabled;
  }

  // ---- Connection ----

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, this.RECONNECT_INTERVAL_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async connect(): Promise<void> {
    this.setStatus("connecting");
    try {
      await this.client.connect();
      this.clearReconnectTimer();
      this.setStatus("connected");
      // Fetch profile and compositions in parallel
      const [profile] = await Promise.allSettled([
        this.client.getUserProfile(),
        this.loadCompositions(),
      ]);
      if (profile.status === "fulfilled") {
        this.conductorProfile = profile.value;
        this.conversationView?.setConductorProfile(this.conductorProfile);
      }
    } catch (err: unknown) {
      // Auth failure (wrong token) — don't retry, user needs to fix their token
      const errCode = err instanceof RpcError ? err.code : undefined;
      const errMsg = err instanceof Error ? err.message : "";
      if (errCode === -32001 || errMsg.includes("Unauthorized")) {
        this.suppressDisconnectHandler = true;
        this.setStatus("error");
        new Notice("Polyphon: invalid API token. Check plugin settings.");
      } else {
        // Connection failure — the "disconnect" event will fire and schedule reconnect
        this.setStatus("disconnected");
      }
    }
  }

  private async loadCompositions(): Promise<void> {
    try {
      const comps = await this.client.compositions();
      this.compositions = comps.map((c) => ({
        ...c,
        voices: c.voices.map((v, i) => ({ ...v, side: i % 2 === 0 ? "left" : "right" })),
      }));
      this.populateCompositionSelect();
    } catch {
      new Notice("Polyphon: failed to load compositions.");
    }
  }

  private populateCompositionSelect(): void {
    if (!this.compositionSelect) return;
    this.compositionSelect.empty();
    this.compositionSelect.createEl("option", { text: "— select a composition —", attr: { value: "" } });
    for (const comp of this.compositions) {
      this.compositionSelect.createEl("option", { text: comp.name, attr: { value: comp.id } });
    }
  }

  // ---- Composition selection ----

  private async onCompositionSelected(): Promise<void> {
    const id = this.compositionSelect?.value;
    if (!id) {
      this.sessionRow?.addClass("polyphon-session-row--hidden");
      return;
    }
    this.activeComposition = this.compositions.find((c) => c.id === id) ?? null;
    await this.loadSessions(id);
  }

  private async loadSessions(compositionId: string): Promise<void> {
    if (!this.sessionSelect || !this.sessionRow) return;
    try {
      const all = await this.client.sessions();
      const sessions = all.filter((s) => s.compositionId === compositionId);
      this.sessionSelect.empty();
      this.sessionSelect.createEl("option", { text: "— resume a session —", attr: { value: "" } });
      const sorted = sessions
        .filter((s) => !s.archived && s.source === "obsidian")
        .sort((a, b) => b.updatedAt - a.updatedAt);
      for (const s of sorted) {
        const date = new Date(s.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        this.sessionSelect.createEl("option", { text: `${s.name} · ${date}`, attr: { value: s.id } });
      }
      this.sessionRow.removeClass("polyphon-session-row--hidden");
    } catch {
      new Notice("Polyphon: failed to load sessions.");
    }
  }

  // ---- Session selection / creation ----

  private async onSessionSelected(): Promise<void> {
    const id = this.sessionSelect?.value;
    if (!id) return;
    await this.resumeSession(id);
  }

  private async resumeSession(sessionId: string): Promise<void> {
    try {
      const session = await this.client.getSession({ id: sessionId });
      this.activeSession = session;
      this.lastSentFilePath = null;
      // Ensure activeComposition is set — may not be if session was resumed directly
      if (!this.activeComposition || this.activeComposition.id !== session.compositionId) {
        this.activeComposition = this.compositions.find((c) => c.id === session.compositionId) ?? this.activeComposition;
      }
      this.conversationView?.clear();
      const messages = await this.client.getMessages({ sessionId });
      for (const msg of messages) {
        if (msg.role === "conductor") {
          this.conversationView?.appendUserMessage(msg.content);
        } else if (msg.role === "voice" && msg.voiceId && msg.voiceName) {
          const voice = this.activeComposition?.voices.find((v) => v.id === msg.voiceId);
          this.conversationView?.appendVoiceMessage(
            msg.voiceId, msg.voiceName, msg.content,
            voice?.color ?? "", voice?.side ?? "left"
          );
        }
      }
      this.renderSessionHeader(session);
      this.renderVoiceRoster();
      this.setSendEnabled(true);
      // Defer final scroll to after layout completes
      window.requestAnimationFrame(() => this.conversationView?.scrollToBottom());
    } catch {
      new Notice("Polyphon: failed to resume session.");
    }
  }

  private async startNewSession(): Promise<void> {
    const compositionId = this.activeComposition?.id ?? this.compositionSelect?.value;
    if (!compositionId) {
      new Notice("Polyphon: select a composition first.");
      return;
    }
    try {
      const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath ?? undefined;
      const vaultName = this.app.vault.getName();
      const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const name = `${vaultName} · ${date}`;
      const session = await this.client.createSession(compositionId, "obsidian", { name, workingDir: vaultPath ?? null });
      this.activeSession = session;
      this.lastSentFilePath = null;
      this.conversationView?.clear();
      this.renderSessionHeader(session);
      this.renderVoiceRoster();
      this.setSendEnabled(true);
      await this.loadSessions(compositionId);
      if (this.sessionSelect) {
        const option = Array.from(this.sessionSelect.options).find((o) => o.value === session.id);
        if (option) this.sessionSelect.value = session.id;
      }
    } catch {
      new Notice("Polyphon: failed to create session.");
    }
  }

  private renderSessionHeader(_session: Session): void {
    // no-op — session title removed, dropdown is sufficient
  }

  private renderVoiceRoster(): void {
    const el = this.voiceRosterEl;
    if (!el) return;
    document.body.querySelectorAll(".polyphon-voice-chip__tooltip").forEach(t => t.remove());
    el.empty();
    this.voiceRosterChips.clear();
    const voices = this.activeComposition?.voices ?? [];
    if (voices.length === 0) {
      el.addClass("polyphon-voice-roster--hidden");
      return;
    }
    el.removeClass("polyphon-voice-roster--hidden");

    for (const voice of voices) {
      const chip = el.createDiv({ cls: "polyphon-voice-chip" });
      chip.style.setProperty("--voice-color", voice.color);
      chip.textContent = voice.displayName.charAt(0).toUpperCase();
      this.voiceRosterChips.set(voice.id, chip);

      const tooltip = document.body.createDiv({ cls: "polyphon-voice-chip__tooltip" });
      tooltip.textContent = voice.displayName;

      chip.addEventListener("mouseenter", () => {
        const r = chip.getBoundingClientRect();
        tooltip.style.left = `${r.left + r.width / 2}px`;
        tooltip.style.top = `${r.bottom + 5}px`;
        tooltip.addClass("polyphon-voice-chip__tooltip--visible");
      });
      chip.addEventListener("mouseleave", () => {
        tooltip.removeClass("polyphon-voice-chip__tooltip--visible");
      });
    }
  }

  private setRosterVoiceState(voiceId: string, state: "idle" | "pending" | "streaming"): void {
    const chip = this.voiceRosterChips.get(voiceId);
    if (!chip) return;
    chip.removeClass("polyphon-voice-chip--pending");
    chip.removeClass("polyphon-voice-chip--streaming");
    if (state === "pending") chip.addClass("polyphon-voice-chip--pending");
    if (state === "streaming") chip.addClass("polyphon-voice-chip--streaming");
  }

  private resetRosterVoiceStates(): void {
    for (const [voiceId] of this.voiceRosterChips) {
      this.setRosterVoiceState(voiceId, "idle");
    }
  }

  // ---- Messaging ----

  private async sendMessage(): Promise<void> {
    const content = this.inputEl?.value.trim();
    if (!content || !this.activeSession) return;
    if (this.inputEl) this.inputEl.value = "";
    this.closeMentionDropdown();

    const activeFile = this.app.workspace.getActiveFile();
    const vaultBase = (this.app.vault.adapter as { basePath?: string }).basePath ?? "";
    const currentPath = activeFile ? `${vaultBase}/${activeFile.path}` : null;
    const messageContent = (currentPath && currentPath !== this.lastSentFilePath)
      ? `> Current file: ${currentPath}\n\n${content}`
      : content;
    if (currentPath) this.lastSentFilePath = currentPath;

    this.conversationView?.appendUserMessage(content);

    // If message targets a specific voice, show only that voice as pending
    const voices = this.activeComposition?.voices ?? [];
    const mentionedVoice = parseMention(messageContent, voices);
    const pendingVoices = mentionedVoice ? [mentionedVoice] : voices;
    this.conversationView?.showPending(pendingVoices);
    for (const v of pendingVoices) this.setRosterVoiceState(v.id, "pending");
    this.setSendEnabled(false);

    const baseChunkHandler = this.conversationView?.createChunkHandler();
    const onChunk: typeof baseChunkHandler = baseChunkHandler
      ? (params) => {
          this.setRosterVoiceState(params.voiceId, "streaming");
          baseChunkHandler(params);
        }
      : undefined;

    try {
      await this.client.broadcast({ sessionId: this.activeSession.id, content: messageContent }, onChunk);
    } catch (err) {
      new Notice("Polyphon: failed to send message.");
      if (this.plugin.settings.debugMode) console.error("[Polyphon]", err);
    } finally {
      this.conversationView?.finalizeStreaming();
      this.resetRosterVoiceStates();
      this.setSendEnabled(true);
      this.inputEl?.focus();
    }
  }
}
