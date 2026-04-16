import type { ILogger } from '@/infra/logging/ILogger';
import type { ReportFormatter } from '@/reporting/ReportFormatter';
import type { ITrainingReportService } from '@/services/training/ITrainingReportService';
import type { IRunner } from './IRunner';

export class ReportRunner implements IRunner {
  constructor(
    private readonly training: ITrainingReportService,
    private readonly formatter: ReportFormatter,
    private readonly logger: ILogger,
  ) {}

  async execute(): Promise<void> {
    const report = await this.training.fetch();
    for (const line of this.formatter.format(report)) this.logger.line(line);
  }
}
