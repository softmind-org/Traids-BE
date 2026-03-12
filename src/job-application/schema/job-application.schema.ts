import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type JobApplicationDocument = HydratedDocument<JobApplication>;

export enum ApplicationStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    WITHDRAWN = 'withdrawn',
}

@Schema({ timestamps: true })
export class JobApplication {
    @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
    job: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Subcontractor', required: true })
    subcontractor: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
    company: Types.ObjectId; // Denormalized for faster queries

    @Prop({ required: true, enum: ApplicationStatus, default: ApplicationStatus.PENDING })
    status: ApplicationStatus;

    // Application Details
    @Prop({ required: true })
    fullName: string; // From subcontractor profile

    @Prop()
    proposedDailyRate: number; // In pounds per hour

    @Prop()
    message: string; // application message

    @Prop({ type: [String], default: [] })
    applicationDocuments: string[]; // Additional documents uploaded with application

    // Timestamps
    @Prop({ default: Date.now })
    appliedAt: Date;
}

export const JobApplicationSchema = SchemaFactory.createForClass(JobApplication);

