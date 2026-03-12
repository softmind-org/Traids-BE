import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { JobSchedulerService } from './job-scheduler.service';
import { TimesheetSchedulerService } from './timesheet-scheduler.service';
import { Job, JobSchema } from '../job/schema/job.schema';
import { TimesheetModule } from '../timesheet/timesheet.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    TimesheetModule,
    InvoiceModule,
  ],
  providers: [SchedulerService, JobSchedulerService, TimesheetSchedulerService],
  exports: [SchedulerService, JobSchedulerService, TimesheetSchedulerService],
})
export class SchedulerModule { }

