import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CisReturnDocument = HydratedDocument<CisReturn>;

export enum CisReturnStatus {
  DRAFT = 'draft',           // auto-generated, not yet reviewed
  SUBMITTED = 'submitted',   // company marked as submitted to HMRC
  PAID = 'paid',             // company has paid HMRC
}

@Schema({ _id: false })
export class CisReturnLineItem {
  @Prop({ type: Types.ObjectId, ref: 'Subcontractor', required: true })
  subcontractor: Types.ObjectId;

  @Prop({ required: true })
  subcontractorName: string;    // snapshot at return generation time

  @Prop()
  subcontractorUtr: string;     // snapshot at return generation time

  @Prop({ required: true })
  grossPaid: number;            // total gross paid to this subcontractor in the period

  @Prop({ required: true })
  cisDeduction: number;         // total CIS withheld for this subcontractor

  @Prop({ required: true })
  netPaid: number;              // grossPaid - cisDeduction

  @Prop({ enum: ['pending', 'submitted', 'failed', 'skipped'], default: 'pending' })
  submissionStatus: string;

  @Prop()
  hmrcSubmissionId?: string;    // submissionId returned by HMRC on success

  @Prop()
  submissionError?: string;     // error message if submission failed
}

export const CisReturnLineItemSchema = SchemaFactory.createForClass(CisReturnLineItem);

@Schema({ timestamps: true })
export class CisReturn {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  company: Types.ObjectId;

  @Prop({ required: true })
  taxYear: string;              // e.g. "2025-26"

  @Prop({ required: true })
  taxMonth: number;             // 1–12 (1 = April, aligned to CIS tax year)

  @Prop({ required: true })
  periodStart: Date;            // 6th of the month

  @Prop({ required: true })
  periodEnd: Date;              // 5th of the following month

  @Prop({ required: true })
  dueDate: Date;                // 19th of the month after period end

  @Prop({ type: [CisReturnLineItemSchema], default: [] })
  lineItems: CisReturnLineItem[];

  @Prop({ required: true, default: 0 })
  totalGross: number;

  @Prop({ required: true, default: 0 })
  totalCisDeduction: number;    // total amount company must remit to HMRC

  @Prop({ required: true, default: 0 })
  totalNet: number;

  @Prop({ required: true, enum: CisReturnStatus, default: CisReturnStatus.DRAFT })
  status: CisReturnStatus;

  @Prop()
  submittedAt?: Date;

  @Prop()
  paidAt?: Date;
}

export const CisReturnSchema = SchemaFactory.createForClass(CisReturn);

// One return per company per tax month
CisReturnSchema.index({ company: 1, taxYear: 1, taxMonth: 1 }, { unique: true });
