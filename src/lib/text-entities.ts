/** Extract #hashtags and @mentions from free text. Both are normalised to lowercase. */

const HASHTAG = /(?:^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{2,50})/gu;
const MENTION = /(?:^|[^\p{L}\p{N}_@])@([a-z0-9_]{3,20})\b/giu;

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(HASHTAG)) out.add(m[1].toLowerCase());
  return [...out].slice(0, 20);
}

export function extractMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(MENTION)) out.add(m[1].toLowerCase());
  return [...out].slice(0, 10);
}
