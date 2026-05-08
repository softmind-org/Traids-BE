import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument, Status } from '../job/schema/job.schema';

@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
  ) {}

  /**
   * Runs every hour — auto-starts jobs whose timelineStartDate has passed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoStartJobs(): Promise<void> {
    this.logger.log('Job scheduler: checking jobs to auto-start...');

    try {
      const now = new Date();

      const jobsToStart = await this.jobModel.find({
        status: Status.PENDING,
        timelineStartDate: { $lte: now },
      });

      for (const job of jobsToStart) {
        await this.jobModel.findByIdAndUpdate(job._id, {
          status: Status.IN_PROGRESS,
        });
        this.logger.log(`Auto-started job: ${job.jobTitle} (${job._id})`);
      }

      if (jobsToStart.length > 0) {
        this.logger.log(`Auto-started ${jobsToStart.length} job(s)`);
      }
    } catch (error) {
      this.logger.error('Error in auto-start jobs cron:', error);
    }
  }

  /**
   * Runs daily at midnight — auto-completes jobs whose timelineEndDate has passed.
   * Once completed, subcontractors can no longer log or submit timesheets for the job.
   */
  @Cron('0 0 * * *')
  async autoCompleteJobs(): Promise<void> {
    this.logger.log('Job scheduler: checking jobs to auto-complete...');

    try {
      // Start of today — jobs whose end date is strictly before today are expired
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const result = await this.jobModel.updateMany(
        {
          status: { $in: [Status.IN_PROGRESS, Status.ACCEPTED] },
          timelineEndDate: { $lt: startOfToday },
        },
        { $set: { status: Status.COMPLETED } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Auto-completed ${result.modifiedCount} job(s)`);
      } else {
        this.logger.log('No jobs to auto-complete');
      }
    } catch (error) {
      this.logger.error('Error in auto-complete jobs cron:', error);
    }
  }
}
