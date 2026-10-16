import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/helpers/obsidianStub"; // patches HTMLElement with Obsidian helpers
import { ConversationView } from "../../src/ConversationView";
import type { Voice } from "../../src/types";

function makeVoice(id: string, name: string, color = "#f00", side: "left" | "right" = "left"): Voice {
  return { id, displayName: name, color, avatarIcon: "x", side };
}

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  // scrollTop setter is a no-op in jsdom — that's fine
  return el;
}

describe("ConversationView", () => {
  let container: HTMLElement;
  let view: ConversationView;

  beforeEach(() => {
    container = makeContainer();
    view = new ConversationView(container);
  });

  // ---- clear ----------------------------------------------------------------

  it("clear() removes all children", () => {
    view.appendUserMessage("hello");
    view.clear();
    expect(container.children).toHaveLength(0);
  });

  // ---- appendUserMessage ----------------------------------------------------

  it("appendUserMessage adds a pm--user element", () => {
    view.appendUserMessage("hello");
    expect(container.querySelector(".pm--user")).not.toBeNull();
  });

  it("appendUserMessage shows message content", () => {
    view.appendUserMessage("test content");
    expect(container.querySelector(".pm__bubble")?.textContent).toBe("test content");
  });

  it("appendUserMessage uses conductor name from profile", () => {
    view.setConductorProfile({ conductorName: "Alice", conductorColor: "#abc", conductorAvatar: "", pronouns: "" });
    view.appendUserMessage("hi");
    expect(container.querySelector(".pm__name")?.textContent).toBe("Alice");
  });

  it("appendUserMessage removes conductor typing indicator", () => {
    view.showConductorTyping();
    expect(container.querySelector("[data-conductor-typing]")).not.toBeNull();
    view.appendUserMessage("sent");
    expect(container.querySelector("[data-conductor-typing]")).toBeNull();
  });

  // ---- showConductorTyping / hideConductorTyping ----------------------------

  it("showConductorTyping adds a typing indicator", () => {
    view.showConductorTyping();
    expect(container.querySelector("[data-conductor-typing]")).not.toBeNull();
  });

  it("showConductorTyping only adds one indicator even if called twice", () => {
    view.showConductorTyping();
    view.showConductorTyping();
    expect(container.querySelectorAll("[data-conductor-typing]")).toHaveLength(1);
  });

  it("hideConductorTyping removes the indicator", () => {
    view.showConductorTyping();
    view.hideConductorTyping();
    expect(container.querySelector("[data-conductor-typing]")).toBeNull();
  });

  // ---- appendVoiceMessage ---------------------------------------------------

  it("appendVoiceMessage adds a pm--voice element", () => {
    view.appendVoiceMessage("v1", "Anthropic", "hello", "#D4763B");
    expect(container.querySelector(".pm--voice")).not.toBeNull();
  });

  it("appendVoiceMessage shows voice name", () => {
    view.appendVoiceMessage("v1", "Anthropic", "reply", "#D4763B");
    expect(container.querySelector(".pm__name")?.textContent).toBe("Anthropic");
  });

  it("appendVoiceMessage shows message content", () => {
    view.appendVoiceMessage("v1", "Anthropic", "my reply", "#D4763B");
    expect(container.querySelector(".pm__bubble")?.textContent).toBe("my reply");
  });

  it("appendVoiceMessage applies pm--right class for right side", () => {
    view.appendVoiceMessage("v1", "OpenAI", "hi", "#10A37F", "right");
    expect(container.querySelector(".pm--right")).not.toBeNull();
  });

  it("appendVoiceMessage applies pm--left class for left side", () => {
    view.appendVoiceMessage("v1", "Anthropic", "hi", "#D4763B", "left");
    expect(container.querySelector(".pm--left")).not.toBeNull();
  });

  // ---- showPending ----------------------------------------------------------

  it("showPending creates a pending element per voice", () => {
    view.showPending([makeVoice("v1", "A"), makeVoice("v2", "B")]);
    expect(container.querySelectorAll(".pm--pending")).toHaveLength(2);
  });

  it("showPending creates thinking dots inside each bubble", () => {
    view.showPending([makeVoice("v1", "A")]);
    expect(container.querySelectorAll(".pm__thinking-dot")).toHaveLength(3);
  });

  it("showPending clears previous state before adding new pending voices", () => {
    view.showPending([makeVoice("v1", "A")]);
    view.showPending([makeVoice("v2", "B"), makeVoice("v3", "C")]);
    // old pending elements remain in DOM but internal map is reset
    expect(container.querySelectorAll(".pm__thinking-dot").length).toBeGreaterThanOrEqual(6);
  });

  // ---- createChunkHandler ---------------------------------------------------

  it("chunk handler transitions pending → streaming on first delta", () => {
    view.showPending([makeVoice("v1", "Anthropic", "#f00")]);
    const handler = view.createChunkHandler();
    handler({ voiceId: "v1", voiceName: "Anthropic", delta: "Hello", requestId: 1 });
    expect(container.querySelector(".pm--streaming")).not.toBeNull();
    expect(container.querySelector(".pm--pending")).toBeNull();
  });

  it("chunk handler accumulates deltas", () => {
    view.showPending([makeVoice("v1", "Anthropic")]);
    const handler = view.createChunkHandler();
    handler({ voiceId: "v1", voiceName: "Anthropic", delta: "Hello", requestId: 1 });
    handler({ voiceId: "v1", voiceName: "Anthropic", delta: " world", requestId: 1 });
    const bubble = container.querySelector("[data-voice-id='v1'] .pm__bubble");
    expect(bubble?.textContent).toBe("Hello world");
  });

  it("chunk handler creates a new voice element if not in pending", () => {
    const handler = view.createChunkHandler();
    handler({ voiceId: "v-new", voiceName: "New", delta: "Hi", requestId: 1 });
    expect(container.querySelector("[data-voice-id='v-new']")).not.toBeNull();
  });

  it("chunk handler handles multiple voices independently", () => {
    view.showPending([makeVoice("v1", "A"), makeVoice("v2", "B")]);
    const handler = view.createChunkHandler();
    handler({ voiceId: "v1", voiceName: "A", delta: "from A", requestId: 1 });
    handler({ voiceId: "v2", voiceName: "B", delta: "from B", requestId: 1 });
    expect(container.querySelector("[data-voice-id='v1'] .pm__bubble")?.textContent).toBe("from A");
    expect(container.querySelector("[data-voice-id='v2'] .pm__bubble")?.textContent).toBe("from B");
  });

  // ---- finalizeStreaming ----------------------------------------------------

  it("finalizeStreaming removes pm--streaming class", () => {
    view.showPending([makeVoice("v1", "A")]);
    const handler = view.createChunkHandler();
    handler({ voiceId: "v1", voiceName: "A", delta: "hi", requestId: 1 });
    view.finalizeStreaming();
    expect(container.querySelector(".pm--streaming")).toBeNull();
  });

  it("finalizeStreaming removes the header status dot", () => {
    view.showPending([makeVoice("v1", "A")]);
    const handler = view.createChunkHandler();
    handler({ voiceId: "v1", voiceName: "A", delta: "hi", requestId: 1 });
    view.finalizeStreaming();
    expect(container.querySelector(".pm__status-dot")).toBeNull();
  });

  it("finalizeStreaming shows 'No response' for voices that never streamed", () => {
    view.showPending([makeVoice("v1", "A")]);
    view.finalizeStreaming();
    const bubble = container.querySelector("[data-voice-id='v1'] .pm__bubble");
    expect(bubble?.textContent).toBe("No response");
    expect(bubble?.classList.contains("pm__bubble--no-response")).toBe(true);
  });
});
