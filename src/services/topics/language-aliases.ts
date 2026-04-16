export const LANGUAGE_ALIASES: Record<string, string[]> = {
  anglais: ['english', 'anglais'],
  english: ['english', 'anglais'],
  espagnol: ['spanish', 'espagnol', 'espanol'],
  spanish: ['spanish', 'espagnol', 'espanol'],
  allemand: ['german', 'allemand', 'deutsch'],
  german: ['german', 'allemand', 'deutsch'],
  italien: ['italian', 'italien', 'italiano'],
  italian: ['italian', 'italien', 'italiano'],
  francais: ['french', 'francais'],
  french: ['french', 'francais'],
  portugais: ['portuguese', 'portugais'],
  portuguese: ['portuguese', 'portugais'],
};

export function normalizeLanguage(s: string): string {
  return s.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
