import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Admin, AdminSchema } from './schema/admin.schema';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Invoice, InvoiceSchema } from '../invoice/schema/invoice.schema';
import { Rating, RatingSchema } from '../rating/schema/rating.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
      { name: Job.name, schema: JobSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Rating.name, schema: RatingSchema },
    ]),
    JwtModule.register(jwtModuleOptions),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
