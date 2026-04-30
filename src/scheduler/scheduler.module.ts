import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { JobSchedulerService } from './job-scheduler.service';
import { TimesheetSchedulerService } from './timesheet-scheduler.service';
import { StripeSchedulerService } from './stripe-scheduler.service';
import { CisSchedulerService } from './cis-scheduler.service';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Invoice, InvoiceSchema } from '../invoice/schema/invoice.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { Timesheet, TimesheetSchema } from '../timesheet/schema/timesheet.schema';
import { TimesheetModule } from '../timesheet/timesheet.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { StripeModule } from '../stripe/stripe.module';
import { CisModule } from '../cis/cis.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
      { name: Timesheet.name, schema: TimesheetSchema },
    ]),
    TimesheetModule,
    InvoiceModule,
    StripeModule,
    CisModule,
  ],
  providers: [SchedulerService, JobSchedulerService, TimesheetSchedulerService, StripeSchedulerService, CisSchedulerService],
  exports: [SchedulerService, JobSchedulerService, TimesheetSchedulerService, StripeSchedulerService, CisSchedulerService],
})
export class SchedulerModule { }

