export interface VoiceRef {
  id: string;
  displayName: string;
}

/**
 * Parses the first @VoiceName mention from message content.
 * Mirrors SessionManager.parseMention in the Polyphon main process.
 */
export function parseMention(content: string, voices: VoiceRef[]): VoiceRef | null {
  let firstMatch: { index: number; voice: VoiceRef } | null = null;
  for (const voice of voices) {
    const pattern = new RegExp(
      `(?:^|\\s)@${voice.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|[,.!?])`,
      "i",
    );
    const match = pattern.exec(content);
    if (match && (firstMatch === null || match.index < firstMatch.index)) {
      firstMatch = { index: match.index, voice };
    }
  }
  return firstMatch?.voice ?? null;
}
