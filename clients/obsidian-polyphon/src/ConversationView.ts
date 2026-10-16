import type { StreamChunkHandler } from "./types";
import type { ConductorProfile, Voice } from "./types";

const DEFAULT_CONDUCTOR_COLOR = "#6b7280";

interface VoiceMessageState {
  voiceId: string;
  voiceName: string;
  color: string;
  wrapEl: HTMLElement;
  contentEl: HTMLElement;
  headerDot: HTMLElement | null;
  status: "pending" | "streaming" | "done";
}

export class ConversationView {
  private container: HTMLElement;
  private activeVoiceStates = new Map<string, VoiceMessageState>();
  private conductorProfile: ConductorProfile = {
    conductorName: "You",
    conductorColor: "",
    conductorAvatar: "",
    pronouns: "",
  };

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setConductorProfile(profile: ConductorProfile): void {
    this.conductorProfile = profile;
  }

  clear(): void {
    this.container.empty();
    this.activeVoiceStates.clear();
  }

  private buildConductorBubble(content: string | null): HTMLElement {
    const color = this.conductorProfile.conductorColor || DEFAULT_CONDUCTOR_COLOR;
    const name = this.conductorProfile.conductorName || "You";
    const el = document.createElement("div");
    el.className = "pm pm--user";
    const body = el.createDiv({ cls: "pm__body" });
    const header = body.createDiv({ cls: "pm__header" });
    const avatar = header.createDiv({ cls: "pm__avatar" });
    avatar.style.backgroundColor = `${color}25`;
    avatar.style.color = color;
    const iconSvg = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>`,
      "image/svg+xml"
    ).documentElement;
    avatar.appendChild(document.adoptNode(iconSvg));
    header.createSpan({ cls: "pm__name", text: name });
    if (content === null) {
      // Thinking state
      const bubble = body.createDiv({ cls: "pm__bubble pm__bubble--thinking" });
      for (let i = 0; i < 3; i++) {
        const dot = bubble.createSpan({ cls: "pm__thinking-dot" });
        dot.style.animationDelay = `${i * 0.15}s`;
        dot.style.backgroundColor = color;
      }
    } else {
      const bubble = body.createDiv({ cls: "pm__bubble", text: content });
      bubble.style.borderRightColor = color;
    }
    return el;
  }

  showConductorTyping(): void {
    // Only show once
    if (this.container.querySelector("[data-conductor-typing]")) return;
    const el = this.buildConductorBubble(null);
    el.dataset.conductorTyping = "1";
    this.container.appendChild(el);
    this.scrollToBottom();
  }

  hideConductorTyping(): void {
    this.container.querySelector("[data-conductor-typing]")?.remove();
  }

  appendUserMessage(content: string): void {
    this.hideConductorTyping();
    const el = this.buildConductorBubble(content);
    this.container.appendChild(el);
    this.scrollToBottom();
  }

  appendVoiceMessage(voiceId: string, voiceName: string, content: string, color: string, side: "left" | "right" = "left"): void {
    const el = this.buildVoiceBubble(voiceId, voiceName, color, content, "done", side);
    this.container.appendChild(el);
    this.scrollToBottom();
  }

  showPending(voices: Voice[]): void {
    this.activeVoiceStates.clear();
    for (const voice of voices) {
      const wrapEl = this.buildVoiceBubble(voice.id, voice.displayName, voice.color, null, "pending", voice.side);
      this.container.appendChild(wrapEl);

      const contentEl = wrapEl.querySelector<HTMLElement>(".pm__bubble")!;
      const headerDot = wrapEl.querySelector<HTMLElement>(".pm__status-dot");

      this.activeVoiceStates.set(voice.id, {
        voiceId: voice.id,
        voiceName: voice.displayName,
        color: voice.color,
        wrapEl,
        contentEl,
        headerDot,
        status: "pending",
      });
    }
    this.scrollToBottom();
  }

  createChunkHandler(): StreamChunkHandler {
    return ({ voiceId, voiceName, delta }) => {
      let state = this.activeVoiceStates.get(voiceId);

      if (!state) {
        const wrapEl = this.buildVoiceBubble(voiceId, voiceName, "", null, "streaming");
        this.container.appendChild(wrapEl);
        const contentEl = wrapEl.querySelector<HTMLElement>(".pm__bubble")!;
        const headerDot = wrapEl.querySelector<HTMLElement>(".pm__status-dot");
        state = { voiceId, voiceName, color: "", wrapEl, contentEl, headerDot, status: "streaming" };
        this.activeVoiceStates.set(voiceId, state);
      }

      if (state.status === "pending") {
        state.wrapEl.removeClass("pm--pending");
        state.wrapEl.addClass("pm--streaming");
        state.contentEl.removeClass("pm__bubble--thinking");
        state.contentEl.empty();
        if (state.headerDot) {
          state.headerDot.addClass("pm__status-dot--streaming");
          state.headerDot.removeClass("pm__status-dot--pending");
        }
        state.status = "streaming";
      }

      state.contentEl.textContent = (state.contentEl.textContent ?? "") + delta;
      this.scrollToBottom();
    };
  }

  finalizeStreaming(): void {
    for (const state of this.activeVoiceStates.values()) {
      if (state.status === "pending") {
        state.wrapEl.removeClass("pm--pending");
        state.contentEl.removeClass("pm__bubble--thinking");
        if (!state.contentEl.textContent?.trim()) {
          state.contentEl.addClass("pm__bubble--no-response");
          state.contentEl.textContent = "No response";
        }
      }
      state.wrapEl.removeClass("pm--streaming");
      if (state.headerDot) {
        state.headerDot.remove();
      }
      state.status = "done";
    }
    this.activeVoiceStates.clear();
  }

  private buildVoiceBubble(
    voiceId: string,
    voiceName: string,
    color: string,
    content: string | null,
    status: "pending" | "streaming" | "done",
    side: "left" | "right" = "left"
  ): HTMLElement {
    const el = document.createElement("div");
    el.className = `pm pm--voice pm--${status} pm--${side}`;
    el.dataset.voiceId = voiceId;

    // Body
    const body = el.createDiv({ cls: "pm__body" });
    const header = body.createDiv({ cls: "pm__header" });

    // Avatar inline in header
    const avatar = header.createDiv({ cls: "pm__avatar" });
    avatar.textContent = voiceName.charAt(0).toUpperCase();
    if (color) {
      avatar.style.backgroundColor = `${color}25`;
      avatar.style.color = color;
    }

    header.createSpan({ cls: "pm__name", text: voiceName });

    if (status === "pending" || status === "streaming") {
      const dot = header.createSpan({
        cls: `pm__status-dot pm__status-dot--${status}`,
      });
      if (color) dot.style.backgroundColor = color;
    }

    // Bubble
    const bubbleCls = status === "pending"
      ? "pm__bubble pm__bubble--thinking"
      : "pm__bubble";
    const bubble = body.createDiv({ cls: bubbleCls });
    if (color) {
      if (side === "right") {
        bubble.addClass("pm__bubble--right-voice");
        bubble.style.borderRightColor = color;
      } else {
        bubble.style.borderLeftColor = color;
      }
    }

    if (status === "pending") {
      // Thinking dots
      for (let i = 0; i < 3; i++) {
        const dot = bubble.createSpan({ cls: "pm__thinking-dot" });
        dot.style.animationDelay = `${i * 0.15}s`;
        if (color) dot.style.backgroundColor = color;
      }
    } else if (content) {
      bubble.textContent = content;
    }

    return el;
  }

  scrollToBottom(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }
}
