const MONTHS: Record<string, number> = {
  // French
  'janvier': 0, 'fevrier': 1, 'mars': 2, 'avril': 3,
  'mai': 4, 'juin': 5, 'juillet': 6, 'aout': 7,
  'septembre': 8, 'octobre': 9, 'novembre': 10, 'decembre': 11,
  // English
  'january': 0, 'february': 1, 'march': 2, 'april': 3,
  'may': 4, 'june': 5, 'july': 6, 'august': 7,
  'september': 8, 'october': 9, 'november': 10, 'december': 11,
};

function normalizeMonth(name: string): string {
  return name.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function parseDateString(text: string): Date {
  const cleaned = text.trim().toLowerCase();

  // Try "Month Day, Year" format
  const match = /^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/.exec(cleaned);
  if (match) {
    const month = MONTHS[normalizeMonth(match[1])];
    if (month !== undefined) return new Date(Number.parseInt(match[3], 10), month, Number.parseInt(match[2], 10));
  }

  // Try "Day Month Year" format
  const match2 = /^(\d{1,2})\s+(\w+)\s+(\d{4})$/.exec(cleaned);
  if (match2) {
    const month = MONTHS[normalizeMonth(match2[2])];
    if (month !== undefined) return new Date(Number.parseInt(match2[3], 10), month, Number.parseInt(match2[1], 10));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  throw new Error(`Cannot parse date: "${text}"`);
}

export function isCurrentMonthAndYear(date: Date): boolean {
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}
