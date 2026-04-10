import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TimesheetDocument = HydratedDocument<Timesheet>;

export enum TimesheetStatus {
    DRAFT = 'draft',           // subcontractor is still logging
    SUBMITTED = 'submitted',   // locked, awaiting company approval
    APPROVED = 'approved',     // company approved (or auto-approved after 18h)
}

export enum PaymentStatus {
    UNPAID = 'unpaid',
    PROCESSING = 'processing',
    PAID = 'paid',
}

@Schema({ _id: false })
export class DailyLog {
    @Prop({ required: true })
    date: Date; // The specific calendar date (e.g. 2025-11-18)

    @Prop({ required: true })
    checkIn: string; // "08:00 AM"

    @Prop({ required: true })
    checkOut: string; // "05:00 PM"

    @Prop({ required: true, default: 0 })
    hoursWorked: number; // calculated decimal hours

    @Prop({ default: false })
    isLocked: boolean; // true once the week is submitted
}

export const DailyLogSchema = SchemaFactory.createForClass(DailyLog);

@Schema({ timestamps: true })
export class Timesheet {
    @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
    job: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Subcontractor', required: true })
    subcontractor: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
    company: Types.ObjectId; // denormalized for fast queries

    // Week identity — based on job start date, not calendar ISO week
    @Prop({ required: true })
    weekStartDate: Date; // Monday of the week relative to job start

    @Prop({ required: true })
    weekNumber: number; // 1, 2, 3, 4... (relative to job, not ISO)

    @Prop({ type: [DailyLogSchema], default: [] })
    dailyLogs: DailyLog[];

    @Prop({ default: 0 })
    totalHours: number; // sum of all dailyLogs.hoursWorked

    // Rate snapshot at time of submission
    @Prop({ required: true })
    hourlyRate: number; // from JobApplication.proposedDailyRate or Job.hourlyRate

    @Prop({ default: 0 })
    grossAmount: number; // totalHours * hourlyRate

    @Prop({ default: 0.05 })
    platformFeePercent: number; // e.g. 0.05 = 5%

    @Prop({ default: 0 })
    platformFee: number; // grossAmount * platformFeePercent (charged to company)

    @Prop({ default: 0 })
    netPayable: number; // For subcontractor: equals grossAmount (since fee is paid by company)

    @Prop({ required: true, enum: TimesheetStatus, default: TimesheetStatus.DRAFT })
    status: TimesheetStatus;

    // Payment tracking (for future payment feature)
    @Prop({ enum: PaymentStatus, default: PaymentStatus.UNPAID })
    paymentStatus: PaymentStatus;

    @Prop()
    submittedAt?: Date;

    @Prop()
    approvedAt?: Date;

    // Auto-approve deadline: submittedAt + 18 hours
    @Prop()
    reviewWindowExpiry?: Date;

    @Prop()
    paidAt?: Date;
}

export const TimesheetSchema = SchemaFactory.createForClass(Timesheet);

// Compound index: one timesheet per subcontractor per job per week
TimesheetSchema.index({ job: 1, subcontractor: 1, weekNumber: 1 }, { unique: true });
// for scheduler queries
