import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimesheetController } from './timesheet.controller';
import { TimesheetService } from './timesheet.service';
import { Timesheet, TimesheetSchema } from './schema/timesheet.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { JobApplication, JobApplicationSchema } from '../job-application/schema/job-application.schema';
import { Offer, OfferSchema } from '../offer/schema/offer.schema';
import { InvoiceModule } from '../invoice/invoice.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Timesheet.name, schema: TimesheetSchema },
            { name: Job.name, schema: JobSchema },
            { name: JobApplication.name, schema: JobApplicationSchema },
            { name: Offer.name, schema: OfferSchema },
        ]),
        InvoiceModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            signOptions: { expiresIn: '7d' },
        }),
    ],
    controllers: [TimesheetController],
    providers: [TimesheetService],
    exports: [TimesheetService],
})
export class TimesheetModule { }
