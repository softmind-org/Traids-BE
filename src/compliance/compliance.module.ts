import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { Compliance, ComplianceSchema } from './schema/compliance.schema';
import { CommonModule } from '../common/common.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Compliance.name, schema: ComplianceSchema },
        ]),
        JwtModule.register(jwtModuleOptions),
        CommonModule,
    ],
    controllers: [ComplianceController],
    providers: [ComplianceService],
    exports: [ComplianceService],
})
export class ComplianceModule { }
