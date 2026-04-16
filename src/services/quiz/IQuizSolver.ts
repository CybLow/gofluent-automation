import type { SolveResult } from '@/types/report';

export interface IQuizSolver {
  solve(contentUuid: string): Promise<SolveResult>;
}
