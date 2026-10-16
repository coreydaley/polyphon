/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConversationView, type VoiceData } from "./ConversationView";

const ALICE: VoiceData = { id: "v1", displayName: "Alice", color: "#ff0000", side: "left" };
const BOB: VoiceData = { id: "v2", displayName: "Bob", color: "#0000ff", side: "right" };

describe("ConversationView", () => {
  let container: HTMLElement;
  let view: ConversationView;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    view = new ConversationView(container);
  });

  afterEach(() => {
    container.remove();
  });

  // ---- appendUserMessage ----

  describe("appendUserMessage", () => {
    it("adds a conductor bubble with the message text", () => {
      view.appendUserMessage("hello world");
      const bubble = container.querySelector(".pm--user .pm__bubble");
      expect(bubble?.textContent).toBe("hello world");
    });

    it("displays the conductor name in the header", () => {
      view.appendUserMessage("hi");
      expect(container.querySelector(".pm--user .pm__name")?.textContent).toBe("You");
    });

    it("removes any active typing indicator before appending", () => {
      view.showConductorTyping();
      expect(container.querySelector("[data-conductor-typing]")).not.toBeNull();
      view.appendUserMessage("hi");
      expect(container.querySelector("[data-conductor-typing]")).toBeNull();
    });

    it("reflects a custom conductor profile name", () => {
      view.setConductorProfile({ conductorName: "Corey", conductorColor: "#6366f1" });
      view.appendUserMessage("hey");
      expect(container.querySelector(".pm--user .pm__name")?.textContent).toBe("Corey");
    });
  });

  // ---- appendVoiceMessage ----

  describe("appendVoiceMessage", () => {
    it("adds a voice bubble with content and voice name", () => {
      view.appendVoiceMessage("v1", "Alice", "Hello!", "#ff0000", "left");
      const el = container.querySelector(".pm--voice");
      expect(el?.querySelector(".pm__name")?.textContent).toBe("Alice");
      expect(el?.querySelector(".pm__bubble")?.textContent).toBe("Hello!");
    });

    it("sets left border color for a left-side voice", () => {
      view.appendVoiceMessage("v1", "Alice", "hi", "#ff0000", "left");
      const bubble = container.querySelector<HTMLElement>(".pm--voice .pm__bubble");
      expect(bubble?.style.borderLeftColor).toBe("#ff0000");
    });

    it("sets right border color and clears left for a right-side voice", () => {
      view.appendVoiceMessage("v2", "Bob", "hi", "#0000ff", "right");
      const bubble = container.querySelector<HTMLElement>(".pm--voice .pm__bubble");
      expect(bubble?.style.borderRightColor).toBe("#0000ff");
      expect(bubble?.style.borderLeftColor).toBe("transparent");
    });

    it("sets the pm--right class on the wrapper for right-side voices", () => {
      view.appendVoiceMessage("v2", "Bob", "hi", "#0000ff", "right");
      expect(container.querySelector(".pm--right")).not.toBeNull();
    });

    it("uses the voice initial as the avatar letter", () => {
      view.appendVoiceMessage("v1", "Alice", "hi", "#ff0000");
      expect(container.querySelector(".pm__avatar")?.textContent).toBe("A");
    });
  });

  // ---- showConductorTyping / hideConductorTyping ----

  describe("showConductorTyping", () => {
    it("adds a thinking bubble", () => {
      view.showConductorTyping();
      expect(container.querySelector("[data-conductor-typing]")).not.toBeNull();
    });

    it("contains three thinking dots", () => {
      view.showConductorTyping();
      expect(container.querySelectorAll("[data-conductor-typing] .pm__thinking-dot").length).toBe(3);
    });

    it("does not add duplicate typing indicators", () => {
      view.showConductorTyping();
      view.showConductorTyping();
      expect(container.querySelectorAll("[data-conductor-typing]").length).toBe(1);
    });
  });

  describe("hideConductorTyping", () => {
    it("removes the typing indicator", () => {
      view.showConductorTyping();
      view.hideConductorTyping();
      expect(container.querySelector("[data-conductor-typing]")).toBeNull();
    });

    it("is a no-op when no typing indicator exists", () => {
      expect(() => view.hideConductorTyping()).not.toThrow();
    });
  });

  // ---- clear ----

  describe("clear", () => {
    it("removes all content from the container", () => {
      view.appendUserMessage("msg");
      view.appendVoiceMessage("v1", "Alice", "reply", "#ff0000");
      view.clear();
      expect(container.children.length).toBe(0);
    });

    it("is a no-op on an already-empty container", () => {
      expect(() => view.clear()).not.toThrow();
      expect(container.children.length).toBe(0);
    });
  });

  // ---- showPending ----

  describe("showPending", () => {
    it("adds a pending bubble for each voice", () => {
      view.showPending([ALICE, BOB]);
      expect(container.querySelectorAll(".pm--pending").length).toBe(2);
    });

    it("shows three thinking dots per pending voice", () => {
      view.showPending([ALICE]);
      expect(container.querySelectorAll("[data-voice-id='v1'] .pm__thinking-dot").length).toBe(3);
    });

    it("does not apply a border color to pending bubbles", () => {
      view.showPending([ALICE]);
      const bubble = container.querySelector<HTMLElement>("[data-voice-id='v1'] .pm__bubble");
      expect(bubble?.style.borderLeftColor).toBe("");
    });

    it("replaces previously tracked states on repeated calls", () => {
      view.showPending([ALICE]);
      view.showPending([BOB]);
      // Only BOB should be in the active state map — Alice's chunk should create a fresh bubble
      const handler = view.createChunkHandler();
      handler({ voiceId: "v2", voiceName: "Bob", delta: "hi" });
      expect(container.querySelector("[data-voice-id='v2'] .pm__bubble")?.textContent).toBe("hi");
    });
  });

  // ---- createChunkHandler ----

  describe("createChunkHandler", () => {
    it("accumulates text across multiple chunks", () => {
      view.showPending([ALICE]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v1", voiceName: "Alice", delta: "Hello" });
      handler({ voiceId: "v1", voiceName: "Alice", delta: " world" });
      expect(container.querySelector("[data-voice-id='v1'] .pm__bubble")?.textContent).toBe("Hello world");
    });

    it("transitions a pending bubble to streaming on the first chunk", () => {
      view.showPending([ALICE]);
      const handler = view.createChunkHandler();
      const el = container.querySelector("[data-voice-id='v1']");
      expect(el?.classList.contains("pm--pending")).toBe(true);
      handler({ voiceId: "v1", voiceName: "Alice", delta: "hi" });
      expect(el?.classList.contains("pm--pending")).toBe(false);
      expect(el?.classList.contains("pm--streaming")).toBe(true);
    });

    it("applies the voice color to the bubble when transitioning from pending", () => {
      view.showPending([ALICE]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v1", voiceName: "Alice", delta: "hi" });
      const bubble = container.querySelector<HTMLElement>("[data-voice-id='v1'] .pm__bubble");
      expect(bubble?.style.borderLeftColor).toBe("#ff0000");
    });

    it("applies right border for right-side voice on pending→streaming transition", () => {
      view.showPending([BOB]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v2", voiceName: "Bob", delta: "hi" });
      const bubble = container.querySelector<HTMLElement>("[data-voice-id='v2'] .pm__bubble");
      expect(bubble?.style.borderRightColor).toBe("#0000ff");
      expect(bubble?.style.borderLeftColor).toBe("transparent");
    });

    it("creates a new bubble for an unrecognised voiceId", () => {
      const handler = view.createChunkHandler();
      handler({ voiceId: "ghost", voiceName: "Ghost", delta: "boo" });
      expect(container.querySelector("[data-voice-id='ghost']")).not.toBeNull();
    });

    it("handles chunks from multiple voices independently", () => {
      view.showPending([ALICE, BOB]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v1", voiceName: "Alice", delta: "from Alice" });
      handler({ voiceId: "v2", voiceName: "Bob", delta: "from Bob" });
      expect(container.querySelector("[data-voice-id='v1'] .pm__bubble")?.textContent).toBe("from Alice");
      expect(container.querySelector("[data-voice-id='v2'] .pm__bubble")?.textContent).toBe("from Bob");
    });

    it("removes the thinking-dot class when transitioning from pending", () => {
      view.showPending([ALICE]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v1", voiceName: "Alice", delta: "hi" });
      const bubble = container.querySelector("[data-voice-id='v1'] .pm__bubble");
      expect(bubble?.classList.contains("pm__bubble--thinking")).toBe(false);
    });
  });

  // ---- finalizeStreaming ----

  describe("finalizeStreaming", () => {
    it("removes pm--streaming from bubbles after finalization", () => {
      view.showPending([ALICE]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v1", voiceName: "Alice", delta: "hi" });
      view.finalizeStreaming();
      expect(container.querySelector("[data-voice-id='v1']")?.classList.contains("pm--streaming")).toBe(false);
    });

    it("removes the status dot after finalization", () => {
      view.showPending([ALICE]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v1", voiceName: "Alice", delta: "hi" });
      expect(container.querySelector(".pm__status-dot")).not.toBeNull();
      view.finalizeStreaming();
      expect(container.querySelector(".pm__status-dot")).toBeNull();
    });

    it("shows 'No response' for a voice that received no chunks", () => {
      view.showPending([ALICE]);
      view.createChunkHandler(); // handler never called
      view.finalizeStreaming();
      const bubble = container.querySelector("[data-voice-id='v1'] .pm__bubble");
      expect(bubble?.textContent).toBe("No response");
      expect(bubble?.classList.contains("pm__bubble--no-response")).toBe(true);
    });

    it("clears active states after finalization", () => {
      view.showPending([ALICE]);
      const handler = view.createChunkHandler();
      handler({ voiceId: "v1", voiceName: "Alice", delta: "hi" });
      view.finalizeStreaming();
      // A subsequent chunk should create a new bubble rather than appending to old one
      handler({ voiceId: "v1", voiceName: "Alice", delta: "extra" });
      const bubbles = container.querySelectorAll("[data-voice-id='v1'] .pm__bubble");
      expect(bubbles.length).toBe(2);
    });
  });
});
