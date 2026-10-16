import { describe, it, expect } from "vitest";
import { parseMention } from "./parseMention.js";
import type { VoiceRef } from "./parseMention.js";

const voices: VoiceRef[] = [
  { id: "1", displayName: "Alice" },
  { id: "2", displayName: "Bob" },
  { id: "3", displayName: "Dr. Smith" },
];

describe("parseMention", () => {
  it("returns null when no mention", () => {
    expect(parseMention("hello world", voices)).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(parseMention("", voices)).toBeNull();
  });

  it("matches @VoiceName at start of string", () => {
    expect(parseMention("@Alice what do you think?", voices)).toEqual(voices[0]);
  });

  it("matches @VoiceName after whitespace", () => {
    expect(parseMention("hey @Bob can you help?", voices)).toEqual(voices[1]);
  });

  it("matches @VoiceName at end of string", () => {
    expect(parseMention("ask @Alice", voices)).toEqual(voices[0]);
  });

  it("is case-insensitive", () => {
    expect(parseMention("@alice please respond", voices)).toEqual(voices[0]);
    expect(parseMention("@ALICE please respond", voices)).toEqual(voices[0]);
  });

  it("returns first mention when multiple voices are mentioned", () => {
    expect(parseMention("@Alice and @Bob should discuss", voices)).toEqual(voices[0]);
    expect(parseMention("@Bob then @Alice", voices)).toEqual(voices[1]);
  });

  it("does not match @VoiceName inside a word", () => {
    expect(parseMention("email@Alice.com", voices)).toBeNull();
  });

  it("matches with punctuation after the name", () => {
    expect(parseMention("@Alice, what do you think?", voices)).toEqual(voices[0]);
    expect(parseMention("@Bob.", voices)).toEqual(voices[1]);
    expect(parseMention("@Alice!", voices)).toEqual(voices[0]);
  });

  it("handles voices with special regex characters in displayName", () => {
    const result = parseMention("ask @Dr. Smith about this", voices);
    expect(result).toEqual(voices[2]);
  });

  it("returns null when voices array is empty", () => {
    expect(parseMention("@Alice hello", [])).toBeNull();
  });
});
