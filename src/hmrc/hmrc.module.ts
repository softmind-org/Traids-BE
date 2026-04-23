import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { HmrcService } from './hmrc.service';
import { HmrcController } from './hmrc.controller';
import { Company, CompanySchema } from '../company/schema/company.schema';

@Module({
  imports: [
    HttpModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [HmrcController],
  providers: [HmrcService],
  exports: [HmrcService],
})
export class HmrcModule {}
