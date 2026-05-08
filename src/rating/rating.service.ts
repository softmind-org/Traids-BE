import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rating, RatingDocument } from './schema/rating.schema';
import { Job, JobDocument } from '../job/schema/job.schema';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/schema/subcontractor.schema';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
  ) {}

  // ─── SUBMIT RATING ───────────────────────────────────────────────

  async rateSubcontractor(
    jobId: string,
    subcontractorId: string,
    companyId: string,
    rating: number,
    comment?: string,
  ): Promise<RatingDocument> {
    const job = await this.jobModel.findById(jobId);

    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }

    if (job.company.toString() !== companyId) {
      throw new HttpException('Unauthorized — you do not own this job', HttpStatus.FORBIDDEN);
    }

    if (job.status !== 'in_progress' && job.status !== 'completed') {
      throw new HttpException(
        'You can only rate subcontractors on in-progress or completed jobs',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isAssigned = job.assignedTo.some((id) => id.toString() === subcontractorId);
    if (!isAssigned) {
      throw new HttpException(
        'This subcontractor is not assigned to the job',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (rating < 1 || rating > 5) {
      throw new HttpException('Rating must be between 1 and 5', HttpStatus.BAD_REQUEST);
    }

    // Check for duplicate (unique index will also catch this, but give a clear message)
    const existing = await this.ratingModel.findOne({
      job: new Types.ObjectId(jobId),
      subcontractor: new Types.ObjectId(subcontractorId),
    });

    if (existing) {
      throw new HttpException(
        'You have already rated this subcontractor for this job',
        HttpStatus.CONFLICT,
      );
    }

    const newRating = await this.ratingModel.create({
      job: new Types.ObjectId(jobId),
      company: new Types.ObjectId(companyId),
      subcontractor: new Types.ObjectId(subcontractorId),
      rating,
      comment,
    });

    // Recalculate subcontractor's average rating
    await this.recalculateAverageRating(subcontractorId);

    return newRating;
  }

  // ─── GET RATINGS FOR A SUBCONTRACTOR ────────────────────────────

  async getSubcontractorRatings(subcontractorId: string): Promise<{
    averageRating: number;
    totalRatings: number;
    ratings: RatingDocument[];
  }> {
    const sub = await this.subcontractorModel
      .findById(subcontractorId)
      .select('averageRating totalRatings')
      .lean();

    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);

    const ratings = await this.ratingModel
      .find({ subcontractor: new Types.ObjectId(subcontractorId) })
      .populate('company', 'companyName profileImage')
      .populate('job', 'jobTitle trade')
      .sort({ createdAt: -1 })
      .lean();

    return {
      averageRating: sub.averageRating ?? 0,
      totalRatings: sub.totalRatings ?? 0,
      ratings,
    };
  }

  // ─── GET RATINGS FOR A JOB ──────────────────────────────────────

  async getJobRatings(jobId: string): Promise<{
    totalRatings: number;
    averageRating: number;
    ratings: RatingDocument[];
  }> {
    const ratings = await this.ratingModel
      .find({ job: new Types.ObjectId(jobId) })
      .populate('subcontractor', 'fullName primaryTrade profileImage averageRating')
      .populate('company', 'companyName profileImage')
      .sort({ createdAt: -1 })
      .lean();

    const totalRatings = ratings.length;
    const averageRating =
      totalRatings > 0
        ? parseFloat(
            (ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings).toFixed(1),
          )
        : 0;

    return { totalRatings, averageRating, ratings };
  }

  // ─── RECALCULATE AVERAGE ─────────────────────────────────────────

  private async recalculateAverageRating(subcontractorId: string): Promise<void> {
    const result = await this.ratingModel.aggregate([
      { $match: { subcontractor: new Types.ObjectId(subcontractorId) } },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    const average = result[0] ? parseFloat(result[0].average.toFixed(1)) : 0;
    const count = result[0]?.count ?? 0;

    await this.subcontractorModel.findByIdAndUpdate(subcontractorId, {
      averageRating: average,
      totalRatings: count,
    });
  }
}
