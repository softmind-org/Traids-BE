import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { Compliance, ComplianceSchema } from './schema/compliance.schema';
import { CommonModule } from '../common/common.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Compliance.name, schema: ComplianceSchema },
        ]),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            signOptions: { expiresIn: '24h' },
        }),
        CommonModule,
    ],
    controllers: [ComplianceController],
    providers: [ComplianceService],
    exports: [ComplianceService],
})
export class ComplianceModule { }
