import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TimesheetService } from '../timesheet/timesheet.service';
import { InvoiceService } from '../invoice/invoice.service';

/**
 * TimesheetSchedulerService
 *
 * Runs every hour to find submitted timesheets whose 18-hour review window
 * has expired and auto-approves them. After auto-approval it triggers invoice
 * generation for any job+week where all timesheets are now approved.
 */
@Injectable()
export class TimesheetSchedulerService {
    private readonly logger = new Logger(TimesheetSchedulerService.name);

    constructor(
        private readonly timesheetService: TimesheetService,
        private readonly invoiceService: InvoiceService,
    ) { }

    /**
     * Runs every hour on the hour.
     * 1. Auto-approves timesheets whose 18-hour review window has expired.
     * 2. For each unique job+week among auto-approved timesheets, attempts
     *    to generate an invoice if all timesheets for that week are now approved.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleExpiredTimesheets(): Promise<void> {
        this.logger.log('Running timesheet auto-approve job...');

        try {
            const autoApproved = await this.timesheetService.autoApproveExpiredTimesheets();

            if (autoApproved.length === 0) {
                this.logger.log('No expired timesheets found.');
                return;
            }

            this.logger.log(`Auto-approved ${autoApproved.length} timesheet(s). Checking for invoice generation...`);

            // Deduplicate job+week combinations
            const jobWeekPairs = new Map<string, { jobId: string; weekNumber: number }>();
            for (const ts of autoApproved) {
                const key = `${ts.job.toString()}_${ts.weekNumber}`;
                if (!jobWeekPairs.has(key)) {
                    jobWeekPairs.set(key, {
                        jobId: ts.job.toString(),
                        weekNumber: ts.weekNumber,
                    });
                }
            }

            // Attempt invoice generation for each unique job+week
            for (const { jobId, weekNumber } of jobWeekPairs.values()) {
                try {
                    const invoice = await this.invoiceService.maybeGenerateInvoice(
                        jobId,
                        weekNumber,
                    );
                    if (invoice) {
                        this.logger.log(
                            `Invoice ${invoice.invoiceNumber} generated for job ${jobId} week ${weekNumber}`,
                        );
                    }
                } catch (err) {
                    this.logger.error(
                        `Failed to generate invoice for job ${jobId} week ${weekNumber}: ${err.message}`,
                    );
                }
            }
        } catch (err) {
            this.logger.error(`Auto-approve scheduler failed: ${err.message}`);
        }
    }
}
