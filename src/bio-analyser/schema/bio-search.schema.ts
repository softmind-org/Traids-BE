import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type BioSearchDocument = HydratedDocument<BioSearch>;

@Schema({ _id: true })
export class BioSearchMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  /** The company's words, or the one-line summary of the results. */
  @Prop({ required: true })
  text: string;

  /** Assistant turns: what Claude understood the company to be asking for. */
  @Prop({ type: SchemaTypes.Mixed })
  criteria?: unknown;

  /** Assistant turns: the scored matches shown for this search. */
  @Prop({ type: SchemaTypes.Mixed })
  results?: unknown[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const BioSearchMessageSchema = SchemaFactory.createForClass(BioSearchMessage);

/** One Bio Analyser session: a search plus any refinements of it. */
@Schema({ timestamps: true })
export class BioSearch {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  company: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ type: [BioSearchMessageSchema], default: [] })
  messages: BioSearchMessage[];

  @Prop({ default: () => new Date() })
  lastMessageAt: Date;
}

export const BioSearchSchema = SchemaFactory.createForClass(BioSearch);

BioSearchSchema.index({ company: 1, lastMessageAt: -1 });
