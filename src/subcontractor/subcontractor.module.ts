import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Subcontractor, SubcontractorSchema } from './schema/subcontractor.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Invoice, InvoiceSchema } from '../invoice/schema/invoice.schema';
import { SubcontractorService } from './subcontractor.service';
import { SubcontractorController } from './subcontractor.controller';
import { CompanySubcontractorService } from './company-subcontractor.service';
import { CompanySubcontractorController } from './company-subcontractor.controller';
import { CommonModule } from '../common/common.module';
import { JobModule } from '../job/job.module';
import { OfferModule } from '../offer/offer.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subcontractor.name, schema: SubcontractorSchema },
      { name: Job.name, schema: JobSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    CommonModule,
    JobModule,
    OfferModule,
    StripeModule,
  ],
  controllers: [SubcontractorController, CompanySubcontractorController],
  providers: [SubcontractorService, CompanySubcontractorService],
  exports: [SubcontractorService, CompanySubcontractorService],
})
export class SubcontractorModule { }
