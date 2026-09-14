import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PrimaryTrade } from '../../subcontractor/schema/subcontractor.schema';

export type PortfolioItemDocument = HydratedDocument<PortfolioItem>;

export enum PortfolioStatus {
  DRAFT = 'draft',         // private to the subcontractor
  PUBLISHED = 'published', // visible on the profile and to companies
}

/**
 * A piece of past work a subcontractor showcases on their Profile Overview.
 *
 * Self-reported by design: nothing here is verified against Traids jobs, so a
 * portfolio item carries no rating or review. Reviews live on the profile only
 * (see the Rating collection).
 *
 * Every content field is optional so a half-filled form can be saved as a
 * draft; PortfolioService enforces the required set when publishing.
 */
@Schema({ timestamps: true })
export class PortfolioItem {
  @Prop({ type: Types.ObjectId, ref: 'Subcontractor', required: true })
  subcontractor: Types.ObjectId;

  @Prop({ required: true, enum: PortfolioStatus, default: PortfolioStatus.DRAFT })
  status: PortfolioStatus;

  @Prop()
  title?: string;

  /** "Specialty Category" on the form — same values as a subcontractor's trade. */
  @Prop({ enum: PrimaryTrade })
  trade?: PrimaryTrade;

  @Prop()
  briefOverview?: string;

  @Prop()
  clientName?: string;

  @Prop()
  location?: string;

  /** Free text as entered, e.g. "3 Weeks". Display only. */
  @Prop()
  duration?: string;

  /** Free text as entered, e.g. "£12,000 - £15,000". Display only. */
  @Prop()
  costRange?: string;

  @Prop()
  completionDate?: Date;

  /** S3 URLs in display order; the first is the cover image. */
  @Prop({ type: [String], default: [] })
  photos: string[];

  /** "Detailed Project Description" on the form. */
  @Prop()
  description?: string;

  @Prop()
  publishedAt?: Date;
}

export const PortfolioItemSchema = SchemaFactory.createForClass(PortfolioItem);

// Own portfolio (all statuses) and public portfolio (published only), newest first.
PortfolioItemSchema.index({ subcontractor: 1, status: 1, createdAt: -1 });
