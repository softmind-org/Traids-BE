import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Job, JobSchema } from './schema/job.schema';
import { Offer, OfferSchema } from '../offer/schema/offer.schema';
import { JobApplication, JobApplicationSchema } from '../job-application/schema/job-application.schema';
import { Compliance, ComplianceSchema } from '../compliance/schema/compliance.schema';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { HmrcCompanyGuard } from '../auth/guards/hmrc-company.guard';
import { JobApplicationModule } from '../job-application/job-application.module';
import { OfferModule } from '../offer/offer.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: JobApplication.name, schema: JobApplicationSchema },
      { name: Compliance.name, schema: ComplianceSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    JobApplicationModule,
    OfferModule,
    ComplianceModule,
    CommonModule,
  ],
  controllers: [JobController],
  providers: [JobService, HmrcCompanyGuard],
  exports: [JobService],
})
export class JobModule { }
