import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Company, CompanySchema } from './schema/company.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Timesheet, TimesheetSchema } from '../timesheet/schema/timesheet.schema';
import { Invoice, InvoiceSchema } from '../invoice/schema/invoice.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CommonModule } from '../common/common.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Job.name, schema: JobSchema },
      { name: Timesheet.name, schema: TimesheetSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    CommonModule,
    StripeModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule { }
