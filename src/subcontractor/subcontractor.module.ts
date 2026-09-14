import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { Subcontractor, SubcontractorSchema } from './schema/subcontractor.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Invoice, InvoiceSchema } from '../invoice/schema/invoice.schema';
import { Offer, OfferSchema } from '../offer/schema/offer.schema';
import { Timesheet, TimesheetSchema } from '../timesheet/schema/timesheet.schema';
import { JobApplication, JobApplicationSchema } from '../job-application/schema/job-application.schema';
import { SubcontractorService } from './subcontractor.service';
import { SubcontractorController } from './subcontractor.controller';
import { CompanySubcontractorService } from './company-subcontractor.service';
import { CompanySubcontractorController } from './company-subcontractor.controller';
import { CommonModule } from '../common/common.module';
import { JobModule } from '../job/job.module';
import { OfferModule } from '../offer/offer.module';
import { StripeModule } from '../stripe/stripe.module';
import { HmrcModule } from '../hmrc/hmrc.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subcontractor.name, schema: SubcontractorSchema },
      { name: Job.name, schema: JobSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Timesheet.name, schema: TimesheetSchema },
      { name: JobApplication.name, schema: JobApplicationSchema },
    ]),
    JwtModule.register(jwtModuleOptions),
    CommonModule,
    JobModule,
    OfferModule,
    StripeModule,
    HmrcModule,
    PortfolioModule,
    RatingModule,
  ],
  controllers: [SubcontractorController, CompanySubcontractorController],
  providers: [SubcontractorService, CompanySubcontractorService],
  exports: [SubcontractorService, CompanySubcontractorService],
})
export class SubcontractorModule { }
