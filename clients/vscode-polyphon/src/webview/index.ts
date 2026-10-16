// Webview entry point — runs in a sandboxed browser context inside VS Code.
// No Node.js APIs. All Polyphon API calls are proxied through the extension host.

/// <reference lib="dom" />

// ---- Logo SVG (declared first to avoid hoisting issues) ----
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 680" width="22" height="22">
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
</svg>`;

import { ConversationView, type VoiceData } from "./ConversationView";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

const vscode = acquireVsCodeApi();

// ---- State ----
let activeSessionId: string | null = null;
let activeCompositionId: string | null = null;
let voices: VoiceData[] = [];
let attachContext = false;
let chunkHandler: ReturnType<ConversationView["createChunkHandler"]> | null = null;

// ---- DOM ----
const app = document.getElementById("app")!;

function mk<K extends keyof HTMLElementTagNameMap>(tag: K, cls = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

// Header
const header = app.appendChild(mk("div", "polyphon-header"));
const logoEl = header.appendChild(mk("div", "polyphon-header__logo"));
logoEl.innerHTML = LOGO_SVG;
const headerText = header.appendChild(mk("div", "polyphon-header__text"));
headerText.appendChild(mk("span", "polyphon-header__wordmark")).textContent = "Polyphon";
headerText.appendChild(mk("span", "polyphon-header__tagline")).textContent = "One Chat. Many Voices.";
const statusBar = header.appendChild(mk("div", "polyphon-status-bar polyphon-status-bar--disconnected"));
const statusBadge = statusBar.appendChild(mk("span", "polyphon-status-badge"));
statusBadge.textContent = "offline";
statusBadge.addEventListener("click", () => {
  if (statusBadge.dataset.state === "disconnected" || statusBadge.dataset.state === "error") {
    vscode.postMessage({ type: "reconnect" });
  }
});

// Composition select
const topBar = app.appendChild(mk("div", "polyphon-top-bar"));
const compositionSelect = topBar.appendChild(document.createElement("select"));
compositionSelect.className = "polyphon-select";
addOption(compositionSelect, "", "— select a composition —");
compositionSelect.addEventListener("change", () => {
  const id = compositionSelect.value;
  activeCompositionId = id || null;
  sessionRow.classList.toggle("polyphon-session-row--hidden", !id);
  if (id) vscode.postMessage({ type: "selectComposition", compositionId: id });
});

// Session row
const sessionRow = app.appendChild(mk("div", "polyphon-session-row polyphon-session-row--hidden"));
const sessionSelect = sessionRow.appendChild(document.createElement("select"));
sessionSelect.className = "polyphon-select polyphon-session-select";
addOption(sessionSelect, "", "— resume a session —");
sessionSelect.addEventListener("change", () => {
  const id = sessionSelect.value;
  if (id) {
    activeSessionId = id;
    vscode.postMessage({ type: "selectSession", sessionId: id });
  }
});
const newBtn = sessionRow.appendChild(mk("button", "polyphon-btn polyphon-btn--new"));
newBtn.textContent = "New";
newBtn.title = "Start a new session";
newBtn.addEventListener("click", () => {
  if (activeCompositionId) vscode.postMessage({ type: "newSession", compositionId: activeCompositionId });
});

// Voice roster
const voiceRosterEl = app.appendChild(mk("div", "polyphon-voice-roster polyphon-voice-roster--hidden"));
const voiceChips = new Map<string, HTMLElement>();

// Conversation
const conversationEl = app.appendChild(mk("div", "polyphon-conversation"));
const conv = new ConversationView(conversationEl);

// Input area
const inputWrapper = app.appendChild(mk("div", "polyphon-input-wrapper"));
const mentionDropdown = inputWrapper.appendChild(mk("div", "polyphon-mention-dropdown polyphon-mention-dropdown--hidden"));
const contextBar = inputWrapper.appendChild(mk("div", "polyphon-context-bar"));
const contextBtn = contextBar.appendChild(mk("button", "polyphon-btn polyphon-btn--context"));
contextBtn.textContent = "📎 attach context";
contextBtn.title = "Include the current file, selection, and errors with your message";
contextBtn.addEventListener("click", () => {
  attachContext = !attachContext;
  contextBtn.classList.toggle("polyphon-btn--context--active", attachContext);
  contextBtn.textContent = attachContext ? "📎 context attached" : "📎 attach context";
});
const inputArea = inputWrapper.appendChild(mk("div", "polyphon-input-area"));
const inputEl = inputArea.appendChild(document.createElement("textarea"));
inputEl.className = "polyphon-input";
inputEl.placeholder = "Message all voices… (@ to target one)";
inputEl.rows = 3;
const sendBtn = inputArea.appendChild(mk("button", "polyphon-btn polyphon-btn--send"));
sendBtn.textContent = "Send";
sendBtn.disabled = true;

// ---- @mention state ----
let mentionQuery: string | null = null;
let mentionStart = 0;
let mentionIndex = 0;
let mentionFiltered: VoiceData[] = [];

inputEl.addEventListener("input", onInputChange);
inputEl.addEventListener("keydown", (e) => {
  if (mentionQuery !== null && mentionFiltered.length > 0) {
    if (e.key === "ArrowDown") { e.preventDefault(); mentionIndex = (mentionIndex + 1) % mentionFiltered.length; renderMentionDropdown(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); mentionIndex = (mentionIndex - 1 + mentionFiltered.length) % mentionFiltered.length; renderMentionDropdown(); return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionFiltered[mentionIndex]!); return; }
    if (e.key === "Escape") { e.preventDefault(); closeMentionDropdown(); return; }
  }
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener("click", sendMessage);

function onInputChange(): void {
  const val = inputEl.value;
  const cursor = inputEl.selectionStart ?? 0;
  const before = val.slice(0, cursor);
  const match = before.match(/@(\w*)$/);
  if (match) {
    const query = match[1] ?? "";
    mentionQuery = query;
    mentionStart = cursor - match[0].length;
    mentionFiltered = query === ""
      ? voices
      : voices.filter((v) => v.displayName.toLowerCase().startsWith(query.toLowerCase()));
    mentionIndex = 0;
    renderMentionDropdown();
  } else {
    closeMentionDropdown();
  }
}

function renderMentionDropdown(): void {
  mentionDropdown.innerHTML = "";
  if (mentionFiltered.length === 0) { closeMentionDropdown(); return; }
  mentionDropdown.classList.remove("polyphon-mention-dropdown--hidden");
  mentionFiltered.forEach((voice, i) => {
    const item = mentionDropdown.appendChild(mk("div", `polyphon-mention-item${i === mentionIndex ? " polyphon-mention-item--active" : ""}`));
    const avatar = item.appendChild(mk("span", "polyphon-mention-avatar"));
    avatar.style.backgroundColor = `${voice.color}25`;
    avatar.style.color = voice.color;
    avatar.textContent = voice.displayName.charAt(0).toUpperCase();
    item.appendChild(mk("span", "polyphon-mention-name")).textContent = `@${voice.displayName}`;
    item.addEventListener("mousedown", (e) => { e.preventDefault(); insertMention(voice); });
  });
}

function insertMention(voice: VoiceData): void {
  const cursor = inputEl.selectionStart ?? mentionStart;
  const val = inputEl.value;
  const inserted = `@${voice.displayName} `;
  inputEl.value = val.slice(0, mentionStart) + inserted + val.slice(cursor);
  const pos = mentionStart + inserted.length;
  inputEl.setSelectionRange(pos, pos);
  inputEl.focus();
  closeMentionDropdown();
}

function closeMentionDropdown(): void {
  mentionQuery = null;
  mentionFiltered = [];
  mentionDropdown.classList.add("polyphon-mention-dropdown--hidden");
  mentionDropdown.innerHTML = "";
}

function sendMessage(): void {
  const text = inputEl.value.trim();
  if (!text || !activeSessionId) return;
  inputEl.value = "";
  closeMentionDropdown();
  conv.hideConductorTyping();
  vscode.postMessage({ type: "send", text, attachContext });
  if (attachContext) {
    attachContext = false;
    contextBtn.classList.remove("polyphon-btn--context--active");
    contextBtn.textContent = "📎 attach context";
  }
}

// ---- Voice roster ----
function renderVoiceRoster(): void {
  voiceRosterEl.innerHTML = "";
  voiceChips.clear();
  if (voices.length === 0) { voiceRosterEl.classList.add("polyphon-voice-roster--hidden"); return; }
  voiceRosterEl.classList.remove("polyphon-voice-roster--hidden");
  for (const voice of voices) {
    const chip = voiceRosterEl.appendChild(mk("div", "polyphon-voice-chip"));
    chip.style.setProperty("--voice-color", voice.color);
    chip.textContent = voice.displayName.charAt(0).toUpperCase();
    chip.title = voice.displayName;
    voiceChips.set(voice.id, chip);
  }
}

function setVoiceChipState(voiceId: string, state: "idle" | "pending" | "streaming"): void {
  const chip = voiceChips.get(voiceId);
  if (!chip) return;
  chip.classList.remove("polyphon-voice-chip--pending", "polyphon-voice-chip--streaming");
  if (state !== "idle") chip.classList.add(`polyphon-voice-chip--${state}`);
}

// ---- Status ----
function updateStatus(state: string): void {
  const labels: Record<string, string> = {
    disconnected: "offline", connecting: "connecting…", connected: "online", error: "auth error",
  };
  statusBadge.textContent = labels[state] ?? state;
  statusBadge.dataset.state = state;
  statusBar.className = `polyphon-status-bar polyphon-status-bar--${state}`;
  statusBadge.classList.toggle("polyphon-status-badge--clickable", state === "disconnected" || state === "error");
}

// ---- Message handler ----
window.addEventListener("message", (event) => {
  const msg = event.data as Record<string, unknown>;
  switch (msg.type) {
    case "state":
      updateStatus(msg.state as string);
      if (msg.state === "disconnected" || msg.state === "error") setSendEnabled(false);
      break;

    case "profile":
      conv.setConductorProfile({
        conductorName: msg.conductorName as string,
        conductorColor: msg.conductorColor as string,
      });
      break;

    case "compositions": {
      const comps = msg.compositions as Array<{ id: string; name: string }>;
      const activeCompId = msg.activeCompositionId as string | null;
      compositionSelect.innerHTML = "";
      addOption(compositionSelect, "", "— select a composition —");
      comps.forEach((c) => addOption(compositionSelect, c.id, c.name));
      if (activeCompId) {
        compositionSelect.value = activeCompId;
        activeCompositionId = activeCompId;
        sessionRow.classList.remove("polyphon-session-row--hidden");
      }
      break;
    }

    case "sessions": {
      const sessions = msg.sessions as Array<{ id: string; name: string; updatedAt: number }>;
      const activeSessId = msg.activeSessionId as string | null;
      sessionSelect.innerHTML = "";
      addOption(sessionSelect, "", "— resume a session —");
      sessions.forEach((s) => {
        const date = new Date(s.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        addOption(sessionSelect, s.id, `${s.name} · ${date}`);
      });
      if (activeSessId) {
        sessionSelect.value = activeSessId;
        activeSessionId = activeSessId;
      }
      sessionRow.classList.remove("polyphon-session-row--hidden");
      break;
    }

    case "sessionCreated": {
      const session = msg.session as { id: string; name: string };
      activeSessionId = session.id;
      conv.clear();
      setSendEnabled(true);
      break;
    }

    case "voices":
      voices = msg.voices as VoiceData[];
      renderVoiceRoster();
      break;

    case "messages": {
      const messages = msg.messages as Array<{
        id: string; role: string; voiceId: string | null;
        voiceName: string | null; content: string;
      }>;
      conv.clear();
      for (const m of messages) {
        if (m.role === "conductor") {
          conv.appendUserMessage(m.content);
        } else if (m.role === "voice" && m.voiceId && m.voiceName) {
          const voice = voices.find((v) => v.id === m.voiceId);
          conv.appendVoiceMessage(m.voiceId, m.voiceName, m.content, voice?.color ?? "", voice?.side ?? "left");
        }
      }
      setSendEnabled(true);
      requestAnimationFrame(() => conv.scrollToBottom());
      break;
    }

    case "userMessage":
      conv.appendUserMessage(msg.content as string);
      break;

    case "showPending": {
      const pendingVoices = msg.voices as VoiceData[];
      conv.showPending(pendingVoices);
      chunkHandler = conv.createChunkHandler();
      pendingVoices.forEach((v) => setVoiceChipState(v.id, "pending"));
      break;
    }

    case "chunk": {
      const voiceId = msg.voiceId as string;
      if (chunkHandler) {
        chunkHandler({ voiceId, voiceName: msg.voiceName as string, delta: msg.delta as string });
        setVoiceChipState(voiceId, "streaming");
      }
      break;
    }

    case "streamDone":
    case "streamError":
      conv.finalizeStreaming();
      voiceChips.forEach((_, id) => setVoiceChipState(id, "idle"));
      chunkHandler = null;
      break;

    case "sendEnabled":
      setSendEnabled(msg.enabled as boolean);
      break;

    case "prefillInput":
      inputEl.value = msg.text as string;
      inputEl.focus();
      break;

    case "focusCompositionSelect":
      compositionSelect.focus();
      break;
  }
});

// ---- Helpers ----
function setSendEnabled(enabled: boolean): void {
  sendBtn.disabled = !enabled;
  inputEl.disabled = !enabled;
  if (enabled) inputEl.focus();
}

function addOption(select: HTMLSelectElement, value: string, text: string): void {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = text;
  select.appendChild(opt);
}

// Typing indicator
inputEl.addEventListener("input", () => {
  if (inputEl.value.trim()) conv.showConductorTyping();
  else conv.hideConductorTyping();
});

// ---- Typing indicator (debounced hide) ----
// Note: showConductorTyping is already called inside input handler above
// The send action calls hideConductorTyping via conv.appendUserMessage

// Signal ready
vscode.postMessage({ type: "ready" });
