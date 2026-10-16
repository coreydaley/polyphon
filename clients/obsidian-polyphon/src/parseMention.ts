import type { Voice } from "./types";

/**
 * Parses the first @VoiceName mention from message content.
 * Mirrors SessionManager.parseMention in the Polyphon main process.
 */
export function parseMention(content: string, voices: Voice[]): Voice | null {
  let firstMatch: { index: number; voice: Voice } | null = null;
  for (const voice of voices) {
    const pattern = new RegExp(
      `(?:^|\\s)@${voice.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|[,.!?])`,
      "i"
    );
    const match = pattern.exec(content);
    if (match && (firstMatch === null || match.index < firstMatch.index)) {
      firstMatch = { index: match.index, voice };
    }
  }
  return firstMatch?.voice ?? null;
}
