export function normalize(text: string): string {
  return text.trim().toLowerCase().split(/\s+/).join(' ');
}

export function fuzzyMatch(value: string, optionText: string): boolean {
  const v = normalize(value);
  const o = normalize(optionText);
  return v === o || v.includes(o) || o.includes(v);
}

export function bestMatchIndex(value: string, options: string[], threshold = 0.6): number | null {
  const nv = normalize(value);
  let bestIndex: number | null = null;
  let bestRatio = 0;

  for (let i = 0; i < options.length; i++) {
    const ratio = similarityRatio(nv, normalize(options[i]));
    if (ratio > bestRatio && ratio >= threshold) {
      bestRatio = ratio;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const [longer, shorter] = a.length >= b.length ? [a, b] : [b, a];
  const rows = shorter.length + 1;
  const cols = longer.length + 1;

  // Use two rows instead of full matrix to reduce complexity
  let prev = Array.from({ length: cols }, (_, j) => j);
  let curr = new Array<number>(cols);

  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return 1 - prev[cols - 1] / longer.length;
}

const FEEDBACK_PHRASES = [
  'bonne réponse', 'mauvaise réponse', 'correct answer',
  'wrong answer', 'incorrect', 'correct',
];

export function isFeedbackText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return FEEDBACK_PHRASES.some(phrase => lower === phrase || lower.startsWith(phrase));
}
