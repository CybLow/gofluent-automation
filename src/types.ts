export type QuestionType =
  | 'multi-choice-text'
  | 'multi-choice-image'
  | 'multi-choice-checkbox'
  | 'short-text'
  | 'fill-gaps-text'
  | 'fill-gaps-block'
  | 'scrambled-letters'
  | 'scrambled-sentences'
  | 'match-text';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_ORDER: Record<CEFRLevel, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

export type SectionType =
  | 'TITLE'
  | 'SUMMARY'
  | 'VOCABULARY_COLS_IMAGES'
  | 'VOCABULARY_ROWS_IMAGES'
  | 'VOCABULARY_ROWS';

export interface SectionData {
  type: SectionType;
  title?: string;
  description?: string;
  data?: string | string[];
  definitions?: Array<{ key: string; value: string }>;
}

export interface CLIOptions {
  autoRun?: number;
  simpleRun?: string;
  vocabulary: boolean;
  grammar: boolean;
  language: string;
  debug: boolean;
  headless: boolean;
  cache: boolean;
  profile?: string;
  minimumLevel?: CEFRLevel;
  maximumLevel?: CEFRLevel;
  noApi?: boolean;
}

export interface AIProvider {
  apiKey: string;
  baseUrl: string;
  model: string;
  name: string;
}

export interface AppConfig {
  gofluentUsername: string;
  gofluentPassword: string;
  gofluentDomain: string;
  googleAiApiKey: string;
  groqApiKey?: string;
  /** Ordered list of AI providers — first working one is used, rest are fallback */
  aiProviders: AIProvider[];
  whisperModel: string;
}
