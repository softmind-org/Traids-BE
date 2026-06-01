import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Rating, RatingSchema } from './schema/rating.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { RatingService } from './rating.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rating.name, schema: RatingSchema },
      { name: Job.name, schema: JobSchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [RatingService],
  exports: [RatingService],
})
export class RatingModule {}
