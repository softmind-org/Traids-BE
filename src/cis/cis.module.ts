import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { CisReturn, CisReturnSchema } from './schema/cis-return.schema';
import { Invoice, InvoiceSchema } from '../invoice/schema/invoice.schema';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { CisReturnService } from './cis-return.service';
import { CisReturnController } from './cis-return.controller';
import { HmrcModule } from '../hmrc/hmrc.module';

@Module({
  imports: [
    HttpModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    MongooseModule.forFeature([
      { name: CisReturn.name, schema: CisReturnSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
    ]),
    HmrcModule,
  ],
  controllers: [CisReturnController],
  providers: [CisReturnService],
  exports: [CisReturnService],
})
export class CisModule {}
