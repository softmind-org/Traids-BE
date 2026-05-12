import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { CisReturn, CisReturnSchema } from './schema/cis-return.schema';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { CisReturnService } from './cis-return.service';
import { CisReturnController } from './cis-return.controller';

// ── PHASE 2 ──────────────────────────────────────────────────────────────────
// HttpModule, HmrcModule, Invoice, and Subcontractor schemas removed until
// HMRC integration is re-enabled.

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    MongooseModule.forFeature([
      { name: CisReturn.name, schema: CisReturnSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [CisReturnController],
  providers: [CisReturnService],
  exports: [CisReturnService],
})
export class CisModule {}
