// Text similarity helper for duplicate detection (Jaccard + Levenshtein hybrid)
export function calculateTextSimilarity(str1: string, str2: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();

  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0.0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = new Set([...words1, ...words2]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Check substring containment
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.max(jaccard, 0.85);
  }

  return jaccard;
}
