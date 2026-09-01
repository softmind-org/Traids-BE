import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobApplicationController } from './job-application.controller';
import { JobApplicationService } from './job-application.service';
import { JobApplication, JobApplicationSchema } from './schema/job-application.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { Offer, OfferSchema } from '../offer/schema/offer.schema';
import { SocketModule } from '../socket/socket.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: JobApplication.name, schema: JobApplicationSchema },
            { name: Job.name, schema: JobSchema },
            { name: Subcontractor.name, schema: SubcontractorSchema },
            { name: Offer.name, schema: OfferSchema },
        ]),
        SocketModule,
        JwtModule.register(jwtModuleOptions),
        CommonModule,
    ],
    controllers: [JobApplicationController],
    providers: [JobApplicationService],
    exports: [JobApplicationService],
})
export class JobApplicationModule { }
