import { describe, it, expect } from "vitest";
import { parseMention } from "../../src/parseMention";
import type { Voice } from "../../src/types";

function makeVoice(id: string, displayName: string): Voice {
  return { id, displayName, color: "#fff", avatarIcon: "star", side: "left" };
}

const anthropic = makeVoice("v1", "Anthropic");
const openai = makeVoice("v2", "OpenAI");
const voices = [anthropic, openai];

describe("parseMention", () => {
  it("returns null when no @ in message", () => {
    expect(parseMention("hello world", voices)).toBeNull();
  });

  it("returns null when @ does not match any voice", () => {
    expect(parseMention("@Gemini what do you think?", voices)).toBeNull();
  });

  it("matches a voice at the start of the message", () => {
    expect(parseMention("@Anthropic what is 2+2?", voices)).toBe(anthropic);
  });

  it("matches a voice mid-message after a space", () => {
    expect(parseMention("hey @OpenAI can you help?", voices)).toBe(openai);
  });

  it("matches case-insensitively", () => {
    expect(parseMention("@anthropic hello", voices)).toBe(anthropic);
    expect(parseMention("@OPENAI hello", voices)).toBe(openai);
  });

  it("matches when mention is followed by a comma", () => {
    expect(parseMention("@Anthropic, what do you think?", voices)).toBe(anthropic);
  });

  it("matches when mention is followed by a question mark", () => {
    expect(parseMention("@OpenAI?", voices)).toBe(openai);
  });

  it("matches when mention is at end of string", () => {
    expect(parseMention("please respond @Anthropic", voices)).toBe(anthropic);
  });

  it("returns the first mention when multiple voices are mentioned", () => {
    expect(parseMention("@Anthropic and @OpenAI both answer", voices)).toBe(anthropic);
  });

  it("does not match a partial name", () => {
    expect(parseMention("@Anthrop hello", voices)).toBeNull();
  });

  it("does not match when @ is embedded in a word", () => {
    expect(parseMention("email@Anthropic.com", voices)).toBeNull();
  });

  it("handles a voice with special regex characters in name", () => {
    const special = makeVoice("v3", "C++ Expert");
    expect(parseMention("@C++ Expert explain this", [special])).toBe(special);
  });

  it("returns null for empty content", () => {
    expect(parseMention("", voices)).toBeNull();
  });

  it("returns null for empty voice list", () => {
    expect(parseMention("@Anthropic hello", [])).toBeNull();
  });
});
