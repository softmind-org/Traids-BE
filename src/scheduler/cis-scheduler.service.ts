import { Injectable, Logger } from '@nestjs/common';
import { CisReturnService } from '../cis/cis-return.service';

@Injectable()
export class CisSchedulerService {
  private readonly logger = new Logger(CisSchedulerService.name);

  constructor(private readonly cisReturnService: CisReturnService) {}

  // ── PHASE 2 ──────────────────────────────────────────────────────────────
  // CIS generation and HMRC submission deferred to next phase.
  // Uncomment when HMRC integration is re-enabled.

  // @Cron('0 8 6 * *')
  // async generateMonthlyCisReturns(): Promise<void> {
  //   this.logger.log('CIS scheduler: generating monthly returns...');
  //   await this.cisReturnService.generateAllReturnsForPreviousPeriod();
  //   this.logger.log('CIS scheduler: monthly returns complete');
  // }

  // @Cron('0 9 * * *')
  // async retryFailedCisSubmissions(): Promise<void> {
  //   this.logger.log('CIS retry scheduler: starting...');
  //   await this.cisReturnService.retryFailedSubmissions();
  //   this.logger.log('CIS retry scheduler: done');
  // }
}
