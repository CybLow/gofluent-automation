export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_ORDER: Record<CEFRLevel, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

export const ALL_CEFR: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type ActivityCategory = 'vocabulary' | 'grammar' | 'article' | 'video' | 'howto';

export const ALL_CATEGORIES: ActivityCategory[] = ['vocabulary', 'grammar', 'article', 'video', 'howto'];

export const CATEGORY_TARGET_TYPE: Record<ActivityCategory, string> = {
  vocabulary: 'glossary',
  grammar: 'rules',
  article: 'article',
  video: 'video',
  howto: 'practical-guide',
};

export interface CLIOptions {
  autoRun?: number;
  simpleRun?: string;
  vocabulary: boolean;
  grammar: boolean;
  article: boolean;
  video: boolean;
  howto: boolean;
  language: string;
  debug: boolean;
  headless: boolean;
  cache: boolean;
  profile?: string;
  minimumLevel?: CEFRLevel;
  maximumLevel?: CEFRLevel;
}

export interface AppConfig {
  gofluentUsername: string;
  gofluentPassword: string;
  gofluentDomain: string;
}

export interface ActivityInfo {
  contentUuid: string;
  url: string;
  date: Date;
  score: number | null;
  title: string;
  contentType: string;
}

export interface TrainingReport {
  all: ActivityInfo[];
  monthly: ActivityInfo[];
  monthlyValid: ActivityInfo[];
  monthlyFailed: ActivityInfo[];
}
