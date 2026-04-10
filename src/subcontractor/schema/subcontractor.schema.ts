import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubcontractorDocument = HydratedDocument<Subcontractor>;

export enum PrimaryTrade {
  ELECTRICIAN = 'electrician',
  PLUMBER = 'plumber',
  CARPENTER = 'carpenter',
  MASONRY = 'masonry',
}

@Schema({ timestamps: true })
export class Subcontractor {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, enum: PrimaryTrade })
  primaryTrade: PrimaryTrade;

  @Prop()
  yearsOfExperience: number;

  @Prop({ required: true })
  postcode: string;

  @Prop({ required: true })
  cityLocation: string;

  @Prop({ type: { documents: [String], expiresAt: Date }, default: { documents: [], expiresAt: null } })
  insurance: { documents: string[]; expiresAt?: Date };

  @Prop({ type: { documents: [String], expiresAt: Date }, default: { documents: [], expiresAt: null } })
  tickets: { documents: string[]; expiresAt?: Date };

  @Prop({ type: { documents: [String], expiresAt: Date }, default: { documents: [], expiresAt: null } })
  certification: { documents: string[]; expiresAt?: Date };

  @Prop()
  profileImage: string;

  @Prop({ required: true })
  hourlyRate: number;

  @Prop({ default: true })
  availability: boolean;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  professionalBio: string;

  @Prop({ type: [String], default: [] })
  workExamples: string[];

  @Prop()
  phoneNumber: string;

  @Prop({ default: true })
  jobAlerts: boolean;

  @Prop({ default: true })
  timesheetReminders: boolean;

  @Prop()
  resetToken?: string;

  @Prop()
  resetTokenExpires?: Date;

  // Stripe Connect
  @Prop()
  stripeAccountId?: string;

  @Prop({ default: false })
  stripeOnboardingComplete: boolean;
}

export const SubcontractorSchema = SchemaFactory.createForClass(Subcontractor);
