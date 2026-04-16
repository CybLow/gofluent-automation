import type { TrainingReport } from '@/types/report';

export interface ITrainingReportService {
  fetch(): Promise<TrainingReport>;
}
