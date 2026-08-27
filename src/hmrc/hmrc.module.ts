import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { HmrcService } from './hmrc.service';
import { HmrcController } from './hmrc.controller';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';

@Module({
  imports: [
    HttpModule,
    JwtModule.register(jwtModuleOptions),
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
    ]),
  ],
  controllers: [HmrcController],
  providers: [HmrcService],
  exports: [HmrcService],
})
export class HmrcModule {}
