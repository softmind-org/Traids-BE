import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CisReturnService } from '../cis/cis-return.service';

@Injectable()
export class CisSchedulerService {
  private readonly logger = new Logger(CisSchedulerService.name);

  constructor(private readonly cisReturnService: CisReturnService) {}

  /**
   * TODO: change back to '0 8 6 * *' (08:00 on 6th of every month) for production.
   * Running every 5 minutes for testing only.
   */
  @Cron('*/5 * * * *')
  async generateMonthlyCisReturns(): Promise<void> {
    this.logger.log('CIS scheduler: generating monthly returns...');
    await this.cisReturnService.generateAllReturnsForPreviousPeriod();
    this.logger.log('CIS scheduler: monthly returns complete');
  }

  /**
   * Retries failed/skipped HMRC line item submissions once per day at 9am.
   */
  @Cron('0 9 * * *')
  async retryFailedCisSubmissions(): Promise<void> {
    this.logger.log('CIS retry scheduler: starting...');
    await this.cisReturnService.retryFailedSubmissions();
    this.logger.log('CIS retry scheduler: done');
  }
}
