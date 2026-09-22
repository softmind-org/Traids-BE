import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AssistantConversationDocument = HydratedDocument<AssistantConversation>;

export type AssistantUserType = 'company' | 'subcontractor';

@Schema({ _id: true })
export class AssistantMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  /** Plain text shown in the chat UI. */
  @Prop({ required: true })
  text: string;

  /**
   * Assistant turns only: the raw content blocks returned by the Claude API
   * (thinking blocks with signatures, text blocks). They are sent back
   * unchanged on later turns so the conversation history is never edited.
   * Never returned to the client.
   */
  @Prop({ type: SchemaTypes.Mixed })
  content?: unknown[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const AssistantMessageSchema = SchemaFactory.createForClass(AssistantMessage);

/**
 * One chatbot conversation ("chat") for a company or subcontractor user.
 * A user can have many; each is created by its first successful exchange.
 */
@Schema({ timestamps: true })
export class AssistantConversation {
  /** The Company or Subcontractor _id (there's no shared User collection). */
  @Prop({ type: Types.ObjectId, required: true })
  user: Types.ObjectId;

  @Prop({ required: true, enum: ['company', 'subcontractor'] })
  userType: AssistantUserType;

  /** Taken from the first question, for the chat list. */
  @Prop({ required: true })
  title: string;

  @Prop({ type: [AssistantMessageSchema], default: [] })
  messages: AssistantMessage[];

  @Prop({ default: () => new Date() })
  lastMessageAt: Date;
}

export const AssistantConversationSchema = SchemaFactory.createForClass(AssistantConversation);

// Chat list (newest first) and the daily message-limit count.
AssistantConversationSchema.index({ user: 1, userType: 1, lastMessageAt: -1 });
