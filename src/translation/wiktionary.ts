type WiktionaryEntry = {
  partOfSpeech: string;
  definitions: Array<{ definition: string }>;
};

/** Format Dutch Wiktionary REST definitions (max 3 senses). */
export const formatWiktionaryNlDefinitions = (
  data: Record<string, WiktionaryEntry[]> | null | undefined
): string | null => {
  const nlEntries = data?.["nl"];
  if (!nlEntries || nlEntries.length === 0) return null;
  const lines: string[] = [];
  for (const entry of nlEntries) {
    if (lines.length >= 3) break;
    const def = entry.definitions[0]?.definition?.replace(/<[^>]+>/g, "");
    if (def) lines.push(`${entry.partOfSpeech}: ${def}`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
};
