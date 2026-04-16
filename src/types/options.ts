import type { CEFRLevel } from '@/types/cefr';

export interface CommonOptions {
  language: string;
  debug: boolean;
  headless: boolean;
  profile?: string;
}

export interface AutoOptions extends CommonOptions {
  autoRun: number;
  vocabulary: boolean;
  grammar: boolean;
  article: boolean;
  video: boolean;
  howto: boolean;
  cache: boolean;
  minimumLevel?: CEFRLevel;
  maximumLevel?: CEFRLevel;
}

export interface SimpleOptions extends CommonOptions {
  simpleRun: string;
}

export type ReportOptions = CommonOptions;

export type RunMode = 'auto' | 'simple' | 'report';

export interface ParsedCli {
  mode: RunMode;
  common: CommonOptions;
  auto?: AutoOptions;
  simple?: SimpleOptions;
  report?: ReportOptions;
}
