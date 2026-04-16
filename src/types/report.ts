import type { ActivityInfo } from '@/types/activity';

export interface TrainingReport {
  all: ActivityInfo[];
  monthly: ActivityInfo[];
  monthlyValid: ActivityInfo[];
  monthlyFailed: ActivityInfo[];
}

export interface DiscoveredActivity {
  contentUuid: string;
  title: string;
  proficiencies: string[];
}

export interface SolveResult {
  questionCount: number;
  score: number | null;
  skipped: boolean;
}

export interface AuthResult {
  token: string;
  userId: string;
}
