import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Admin, AdminSchema } from './schema/admin.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { Invoice, InvoiceSchema } from '../invoice/schema/invoice.schema';
import { Job, JobSchema } from '../job/schema/job.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Job.name, schema: JobSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
