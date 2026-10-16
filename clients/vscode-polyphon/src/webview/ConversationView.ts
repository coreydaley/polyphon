// No VS Code or Node.js imports — platform-agnostic renderer.

export interface VoiceData {
  id: string;
  displayName: string;
  color: string;
  side: "left" | "right";
}

export interface ConductorProfile {
  conductorName: string;
  conductorColor: string;
}

export type ChunkHandler = (params: { voiceId: string; voiceName: string; delta: string }) => void;

interface VoiceMessageState {
  voiceId: string;
  wrapEl: HTMLElement;
  contentEl: HTMLElement;
  headerDot: HTMLElement | null;
  status: "pending" | "streaming" | "done";
  color: string;
  side: "left" | "right";
}

const DEFAULT_CONDUCTOR_COLOR = "#6b7280";

const PENCIL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>`;

export class ConversationView {
  private readonly _container: HTMLElement;
  private readonly _activeStates = new Map<string, VoiceMessageState>();
  private _profile: ConductorProfile = { conductorName: "You", conductorColor: "" };

  constructor(container: HTMLElement) {
    this._container = container;
  }

  setConductorProfile(profile: ConductorProfile): void {
    this._profile = profile;
  }

  clear(): void {
    this._container.innerHTML = "";
    this._activeStates.clear();
  }

  appendUserMessage(content: string): void {
    this._hideConductorTyping();
    this._container.appendChild(this._buildConductorBubble(content));
    this.scrollToBottom();
  }

  appendVoiceMessage(
    voiceId: string,
    voiceName: string,
    content: string,
    color: string,
    side: "left" | "right" = "left",
  ): void {
    this._container.appendChild(this._buildVoiceBubble(voiceId, voiceName, color, content, "done", side));
    this.scrollToBottom();
  }

  showConductorTyping(): void {
    if (this._container.querySelector("[data-conductor-typing]")) return;
    const el = this._buildConductorBubble(null);
    el.dataset.conductorTyping = "1";
    this._container.appendChild(el);
    this.scrollToBottom();
  }

  hideConductorTyping(): void {
    this._hideConductorTyping();
  }

  showPending(voices: VoiceData[]): void {
    this._activeStates.clear();
    for (const voice of voices) {
      const wrapEl = this._buildVoiceBubble(voice.id, voice.displayName, voice.color, null, "pending", voice.side);
      this._container.appendChild(wrapEl);
      const contentEl = wrapEl.querySelector<HTMLElement>(".pm__bubble")!;
      const headerDot = wrapEl.querySelector<HTMLElement>(".pm__status-dot");
      this._activeStates.set(voice.id, {
        voiceId: voice.id,
        wrapEl,
        contentEl,
        headerDot: headerDot ?? null,
        status: "pending",
        color: voice.color,
        side: voice.side,
      });
    }
    this.scrollToBottom();
  }

  createChunkHandler(): ChunkHandler {
    return ({ voiceId, voiceName, delta }) => {
      let state = this._activeStates.get(voiceId);

      if (!state) {
        const wrapEl = this._buildVoiceBubble(voiceId, voiceName, "", null, "streaming");
        this._container.appendChild(wrapEl);
        const contentEl = wrapEl.querySelector<HTMLElement>(".pm__bubble")!;
        const headerDot = wrapEl.querySelector<HTMLElement>(".pm__status-dot");
        state = { voiceId, wrapEl, contentEl, headerDot: headerDot ?? null, status: "streaming", color: "", side: "left" };
        this._activeStates.set(voiceId, state);
      }

      if (state.status === "pending") {
        state.wrapEl.classList.remove("pm--pending");
        state.wrapEl.classList.add("pm--streaming");
        state.contentEl.classList.remove("pm__bubble--thinking");
        state.contentEl.innerHTML = "";
        if (state.color) {
          if (state.side === "right") {
            state.contentEl.style.borderRightColor = state.color;
            state.contentEl.style.borderLeftColor = "transparent";
          } else {
            state.contentEl.style.borderLeftColor = state.color;
          }
        }
        if (state.headerDot) {
          state.headerDot.classList.add("pm__status-dot--streaming");
          state.headerDot.classList.remove("pm__status-dot--pending");
        }
        state.status = "streaming";
      }

      state.contentEl.textContent = (state.contentEl.textContent ?? "") + delta;
      this.scrollToBottom();
    };
  }

  finalizeStreaming(): void {
    for (const state of this._activeStates.values()) {
      if (state.status === "pending") {
        state.wrapEl.classList.remove("pm--pending");
        state.contentEl.classList.remove("pm__bubble--thinking");
        if (!state.contentEl.textContent?.trim()) {
          state.contentEl.classList.add("pm__bubble--no-response");
          state.contentEl.textContent = "No response";
        }
      }
      state.wrapEl.classList.remove("pm--streaming");
      state.headerDot?.remove();
      state.status = "done";
    }
    this._activeStates.clear();
  }

  scrollToBottom(): void {
    this._container.scrollTop = this._container.scrollHeight;
  }

  private _hideConductorTyping(): void {
    this._container.querySelector("[data-conductor-typing]")?.remove();
  }

  private _buildConductorBubble(content: string | null): HTMLElement {
    const color = this._profile.conductorColor || DEFAULT_CONDUCTOR_COLOR;
    const name = this._profile.conductorName || "You";

    const el = document.createElement("div");
    el.className = "pm pm--user";

    const body = el.appendChild(mk("div", "pm__body"));
    const header = body.appendChild(mk("div", "pm__header"));

    const avatar = header.appendChild(mk("div", "pm__avatar"));
    avatar.style.backgroundColor = `${color}25`;
    avatar.style.color = color;
    const parser = new DOMParser();
    const iconDoc = parser.parseFromString(PENCIL_ICON_SVG, "image/svg+xml");
    avatar.appendChild(document.adoptNode(iconDoc.documentElement));

    header.appendChild(mk("span", "pm__name")).textContent = name;

    if (content === null) {
      const bubble = body.appendChild(mk("div", "pm__bubble pm__bubble--thinking"));
      for (let i = 0; i < 3; i++) {
        const dot = bubble.appendChild(mk("span", "pm__thinking-dot"));
        dot.style.animationDelay = `${i * 0.15}s`;
        dot.style.backgroundColor = color;
      }
    } else {
      const bubble = body.appendChild(mk("div", "pm__bubble"));
      bubble.style.borderRightColor = color;
      bubble.textContent = content;
    }

    return el;
  }

  private _buildVoiceBubble(
    voiceId: string,
    voiceName: string,
    color: string,
    content: string | null,
    status: "pending" | "streaming" | "done",
    side: "left" | "right" = "left",
  ): HTMLElement {
    const el = document.createElement("div");
    el.className = `pm pm--voice pm--${status} pm--${side}`;
    el.dataset.voiceId = voiceId;

    const body = el.appendChild(mk("div", "pm__body"));
    const header = body.appendChild(mk("div", "pm__header"));

    const avatar = header.appendChild(mk("div", "pm__avatar"));
    avatar.textContent = voiceName.charAt(0).toUpperCase();
    if (color) {
      avatar.style.backgroundColor = `${color}25`;
      avatar.style.color = color;
    }

    header.appendChild(mk("span", "pm__name")).textContent = voiceName;

    if (status === "pending" || status === "streaming") {
      const dot = header.appendChild(mk("span", `pm__status-dot pm__status-dot--${status}`));
      if (color) dot.style.backgroundColor = color;
    }

    const bubbleCls = status === "pending" ? "pm__bubble pm__bubble--thinking" : "pm__bubble";
    const bubble = body.appendChild(mk("div", bubbleCls));

    if (color && status !== "pending") {
      if (side === "right") {
        bubble.style.borderRightColor = color;
        bubble.style.borderLeftColor = "transparent";
      } else {
        bubble.style.borderLeftColor = color;
      }
    }

    if (status === "pending") {
      for (let i = 0; i < 3; i++) {
        const dot = bubble.appendChild(mk("span", "pm__thinking-dot"));
        dot.style.animationDelay = `${i * 0.15}s`;
        if (color) dot.style.backgroundColor = color;
      }
    } else if (content) {
      bubble.textContent = content;
    }

    return el;
  }
}

function mk<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = cls;
  return el;
}
