import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InvoiceDocument = HydratedDocument<Invoice>;

export enum InvoiceStatus {
    DRAFT = 'draft',         // being assembled (not all timesheets approved yet — not used currently)
    FINALIZED = 'finalized', // all timesheets approved, ready to pay
    PAID = 'paid',           // payment confirmed
}

export enum InvoicePaymentStatus {
    UNPAID = 'unpaid',
    PROCESSING = 'processing',
    PAID = 'paid',
}

@Schema({ _id: false })
export class InvoiceLineItem {
    @Prop({ type: Types.ObjectId, ref: 'Subcontractor', required: true })
    subcontractor: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Timesheet', required: true })
    timesheet: Types.ObjectId;

    @Prop({ required: true })
    subcontractorName: string; // snapshot for display

    @Prop({ required: true })
    hours: number;

    @Prop({ required: true })
    hourlyRate: number;

    @Prop({ required: true })
    grossAmount: number; // hours * hourlyRate

    @Prop({ required: true, default: 0.1 })
    platformFeePercent: number;

    @Prop({ required: true })
    platformFee: number; // grossAmount * platformFeePercent

    @Prop({ required: true })
    netPayable: number; // grossAmount - platformFee

    // CIS (Construction Industry Scheme) — future ready
    @Prop({ default: 0 })
    cisRate: number; // e.g. 0.20 = 20%

    @Prop({ default: 0 })
    cisAmount: number; // grossAmount * cisRate
}

export const InvoiceLineItemSchema = SchemaFactory.createForClass(InvoiceLineItem);

@Schema({ timestamps: true })
export class Invoice {
    @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
    job: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
    company: Types.ObjectId;

    @Prop({ required: true, unique: true })
    invoiceNumber: string; // e.g. INV-00101

    @Prop({ required: true })
    weekNumber: number; // relative to job start (1, 2, 3...)

    @Prop({ required: true })
    weekStartDate: Date;

    @Prop({ type: [InvoiceLineItemSchema], default: [] })
    lineItems: InvoiceLineItem[];

    @Prop({ required: true, default: 0 })
    subtotal: number; // sum of all lineItems.grossAmount

    @Prop({ required: true, default: 0 })
    totalPlatformFee: number; // sum of all lineItems.platformFee

    @Prop({ required: true, default: 0 })
    totalAmount: number; // sum of all lineItems.netPayable

    @Prop({ required: true, enum: InvoiceStatus, default: InvoiceStatus.FINALIZED })
    status: InvoiceStatus;

    @Prop({ enum: InvoicePaymentStatus, default: InvoicePaymentStatus.UNPAID })
    paymentStatus: InvoicePaymentStatus;

    @Prop()
    dueDate?: Date; // for future payment processing

    @Prop()
    paidAt?: Date;

    // Future payment gateway fields — extensible
    @Prop({ type: Object })
    paymentMetadata?: Record<string, any>; // Stripe charge ID, bank ref, etc.
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// Index: efficient lookup by company, job, week
InvoiceSchema.index({ job: 1, weekNumber: 1 }, { unique: true });
