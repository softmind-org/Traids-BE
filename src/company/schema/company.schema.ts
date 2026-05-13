import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

export enum IndustryType {
  CONSTRUCTION = 'construction',
  FACILITIES_MANAGEMENT = 'facilities_management',
  RECRUITMENT = 'recruitment',
}

const SENSITIVE_FIELDS = [
  'password', 'resetToken', 'resetTokenExpires',
  'stripeCustomerId', 'stripeDefaultPaymentMethodId',
  'hmrcAccessToken', 'hmrcRefreshToken', 'hmrcTokenExpiry',
];

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      SENSITIVE_FIELDS.forEach((f) => delete ret[f]);
      return ret;
    },
  },
})
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

  // HMRC / CIS
  @Prop()
  utr?: string;                     // Company Unique Taxpayer Reference (10 digits)

  @Prop()
  employerReference?: string;       // PAYE employer reference (e.g. 123/AB456)

  @Prop({ default: false })
  hmrcConnected: boolean;

  @Prop()
  hmrcAccessToken?: string;

  @Prop()
  hmrcRefreshToken?: string;

  @Prop()
  hmrcTokenExpiry?: Date;           // When the access token expires
}

export const CompanySchema = SchemaFactory.createForClass(Company);
