import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Trade } from './job.schema';

export type SavedJobDocument = HydratedDocument<SavedJob>;

/**
 * A reusable job template — the "Save for Later" action on the Post New Job
 * form, surfaced as the "Saved Jobs" tab in My Jobs.
 *
 * Deliberately a separate collection rather than a flag on Job:
 *  - Job makes jobTitle/trade/description/siteAddress/timeline/hourlyRate all
 *    required, but Save for Later must accept a half-filled form.
 *  - A Job row defaults to status PENDING, which would immediately expose it to
 *    subcontractors via GET /jobs/available and auto-create a compliance record.
 *
 * Every field below is therefore optional. Publishing validates completeness at
 * that point instead (see JobService.publishSavedJob).
 */
@Schema({ timestamps: true })
export class SavedJob {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  company: Types.ObjectId;

  @Prop()
  jobTitle?: string;

  @Prop({ enum: Trade })
  trade?: Trade;

  @Prop()
  description?: string;

  @Prop()
  siteAddress?: string;

  @Prop()
  timelineStartDate?: Date;

  @Prop()
  timelineEndDate?: Date;

  @Prop()
  hourlyRate?: number;

  @Prop({ type: [String], default: [] })
  projectDocuments: string[];

  @Prop({ default: 1 })
  workersRequired?: number;

  /** Set when this template has been used to publish a real job. */
  @Prop()
  lastPublishedAt?: Date;

  /** How many jobs have been created from this template. */
  @Prop({ default: 0 })
  timesPublished: number;
}

export const SavedJobSchema = SchemaFactory.createForClass(SavedJob);

// The Saved Jobs tab lists a company's templates newest-first.
SavedJobSchema.index({ company: 1, createdAt: -1 });
