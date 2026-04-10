import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

export enum IndustryType {
  CONSTRUCTION = 'construction',
  FACILITIES_MANAGEMENT = 'facilities_management',
  RECRUITMENT = 'recruitment',
}

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true })
  companyName: string;

  @Prop({ required: true, unique: true })
  registrationNumber: string;

  @Prop()
  vatNumber: string;

  @Prop({ required: true, enum: IndustryType })
  industryType: IndustryType;

  @Prop({ required: true })
  primaryContactName: string;

  @Prop({ required: true, unique: true })
  workEmail: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  headOfficeAddress: string;

  @Prop({ type: [String], default: [] })
  companyDocuments: string[];

  @Prop()
  insuranceCertificate: string;

  @Prop()
  healthAndSafetyPolicy: string;

  @Prop()
  aboutUs: string;

  @Prop()
  profileImage: string;

  @Prop({ default: true })
  timesheetReminders: boolean;

  @Prop()
  resetToken?: string;

  @Prop()
  resetTokenExpires?: Date;

  // Stripe
  @Prop()
  stripeCustomerId?: string;

  @Prop()
  stripeDefaultPaymentMethodId?: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
