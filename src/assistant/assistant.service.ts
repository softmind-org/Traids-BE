import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import {
  AssistantConversation,
  AssistantConversationDocument,
  AssistantMessage,
  AssistantUserType,
} from './schema/assistant-conversation.schema';

/** DI token for the Anthropic client — overridable in tests. `null` when no API key is configured. */
export const ASSISTANT_ANTHROPIC_CLIENT = 'ASSISTANT_ANTHROPIC_CLIENT';

/**
 * Claude Sonnet 5 — chosen after an A/B against Claude Opus 5 on the same
 * questions: same accuracy on this workload, ~2.6x cheaper and ~1.7x faster.
 * Override with ASSISTANT_MODEL to try a different model without a code change.
 */
const MODEL = process.env.ASSISTANT_MODEL || 'claude-sonnet-5';

/**
 * Server-side refusal fallback applies to models whose safety classifiers can
 * decline a request (the Opus 5 and Fable families). Sending it for other
 * models would be rejected, so it's only added for those.
 */
const SUPPORTS_FALLBACKS = /^claude-(opus-5|fable)/.test(MODEL);
const MAX_TOKENS = 16000;
/** Help-desk Q&A doesn't benefit from deep reasoning; low effort keeps it fast and cheap. */
const EFFORT = 'low';
/** Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const KNOWLEDGE_FILES: Record<AssistantUserType, string> = {
  company: 'COMPANY_KNOWLEDGE_BASE.md',
  subcontractor: 'SUBCONTRACTOR_KNOWLEDGE_BASE.md',
};
const INSTRUCTIONS_FILE = 'ASSISTANT_INSTRUCTIONS.md';

const REFUSAL_REPLY =
  "Sorry, I can't help with that. I can answer questions about using the Traids app.";

const TITLE_MAX_LENGTH = 60;

/** A chat message as returned to the client — never includes raw API blocks. */
export interface AssistantMessageView {
  _id: Types.ObjectId;
  role: 'user' | 'assistant';
  text: string;
  createdAt: Date;
}

@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);

  /** Per role: [instructions, knowledge base]. Byte-identical on every request so it stays cached. */
  private systemPrompts: Partial<Record<AssistantUserType, Anthropic.Beta.BetaTextBlockParam[]>> = {};

  private readonly dailyMessageLimit = Number(process.env.ASSISTANT_DAILY_MESSAGE_LIMIT) || 30;
  private readonly maxMessagesPerConversation =
    Number(process.env.ASSISTANT_MAX_MESSAGES_PER_CONVERSATION) || 40;

  constructor(
    @InjectModel(AssistantConversation.name)
    private conversationModel: Model<AssistantConversationDocument>,
    @Inject(ASSISTANT_ANTHROPIC_CLIENT)
    private readonly client: Anthropic | null,
  ) { }

  // ─────────────────────────────────────────────────────────────
  // KNOWLEDGE BASE
  // ─────────────────────────────────────────────────────────────

  /**
   * Load the knowledge base once at startup. A missing file disables the
   * assistant (503) rather than crashing the whole API.
   */
  onModuleInit(): void {
    const dir = process.env.ASSISTANT_KB_DIR || path.join(process.cwd(), 'knowledge-base');

    try {
      const instructions = fs.readFileSync(path.join(dir, INSTRUCTIONS_FILE), 'utf-8');

      for (const userType of Object.keys(KNOWLEDGE_FILES) as AssistantUserType[]) {
        const knowledge = fs.readFileSync(path.join(dir, KNOWLEDGE_FILES[userType]), 'utf-8');

        // Real markers are "[CONFIRM: …]"; the instructions mention "[CONFIRM]" itself.
        if (/\[CONFIRM:/.test(instructions + knowledge)) {
          this.logger.warn(
            `Knowledge base for ${userType} still contains [CONFIRM] markers — resolve them before go-live`,
          );
        }

        this.systemPrompts[userType] = [
          { type: 'text', text: instructions },
          // Cache breakpoint after the knowledge base: every user of the same
          // role shares this prefix, so repeat questions read it from cache.
          { type: 'text', text: knowledge, cache_control: { type: 'ephemeral' } },
        ];
      }

      this.logger.log(`Assistant knowledge base loaded from ${dir}`);
    } catch (err) {
      this.systemPrompts = {};
      this.logger.error(`Assistant disabled — could not load knowledge base from ${dir}: ${err.message}`);
    }

    if (!this.client) {
      this.logger.error('Assistant disabled — ANTHROPIC_API_KEY is not set');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CHAT
  // ─────────────────────────────────────────────────────────────

  /**
   * Send a message. With no conversationId a new chat is started; otherwise
   * the message continues that chat. The question and answer are saved
   * together only after a successful reply, so a failed call leaves no
   * half-finished exchange behind.
   */
  async chat(
    userId: string,
    userType: AssistantUserType,
    message: string,
    conversationId?: string,
  ): Promise<{
    conversationId: Types.ObjectId;
    title: string;
    isNewConversation: boolean;
    messages: AssistantMessageView[];
  }> {
    const system = this.systemPrompts[userType];
    if (!system || !this.client) {
      throw new HttpException(
        'The assistant is unavailable right now. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const conversation = conversationId
      ? await this.findOwnConversation(conversationId, userId, userType)
      : null;

    if (conversation && conversation.messages.length + 2 > this.maxMessagesPerConversation) {
      throw new BadRequestException(
        'This chat has reached its message limit. Please start a new chat.',
      );
    }

    await this.assertWithinDailyLimit(userId, userType);

    // Earlier turns are replayed exactly as they were stored: user text, and
    // the assistant's raw content blocks. History is only ever appended to.
    const history: Anthropic.Beta.BetaMessageParam[] = (conversation?.messages ?? []).map(
      (m) => ({
        role: m.role,
        content:
          m.role === 'assistant' && Array.isArray(m.content) && m.content.length > 0
            ? (m.content as Anthropic.Beta.BetaContentBlockParam[])
            : m.text,
      }),
    );
    history.push({ role: 'user', content: message });

    const { text, content } = await this.askClaude(system, history);

    const now = new Date();
    const userMessage = { role: 'user' as const, text: message, createdAt: now };
    const assistantMessage = {
      role: 'assistant' as const,
      text,
      content,
      createdAt: new Date(now.getTime() + 1),
    };

    let saved: AssistantConversationDocument | null;
    if (conversation) {
      saved = await this.conversationModel.findOneAndUpdate(
        { _id: conversation._id, user: new Types.ObjectId(userId), userType },
        {
          $push: { messages: { $each: [userMessage, assistantMessage] } },
          $set: { lastMessageAt: assistantMessage.createdAt },
        },
        { new: true },
      );
      if (!saved) {
        throw new NotFoundException('Conversation not found');
      }
    } else {
      saved = await this.conversationModel.create({
        user: new Types.ObjectId(userId),
        userType,
        title: this.buildTitle(message),
        messages: [userMessage, assistantMessage],
        lastMessageAt: assistantMessage.createdAt,
      });
    }

    return {
      conversationId: saved._id,
      title: saved.title,
      isNewConversation: !conversation,
      messages: saved.messages.slice(-2).map((m) => this.toView(m)),
    };
  }

  /** The user's chats, newest first — titles only, no messages. */
  async listConversations(userId: string, userType: AssistantUserType) {
    const conversations = await this.conversationModel.aggregate([
      { $match: { user: new Types.ObjectId(userId), userType } },
      { $sort: { lastMessageAt: -1 } },
      { $limit: 100 },
      {
        $project: {
          title: 1,
          createdAt: 1,
          lastMessageAt: 1,
          messageCount: { $size: '$messages' },
        },
      },
    ]);
    return conversations;
  }

  /** One chat with every message, for reopening it. */
  async getConversation(conversationId: string, userId: string, userType: AssistantUserType) {
    const conversation = await this.findOwnConversation(conversationId, userId, userType);

    return {
      _id: conversation._id,
      title: conversation.title,
      createdAt: (conversation as any).createdAt,
      lastMessageAt: conversation.lastMessageAt,
      messages: conversation.messages.map((m) => this.toView(m)),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  private async askClaude(
    system: Anthropic.Beta.BetaTextBlockParam[],
    messages: Anthropic.Beta.BetaMessageParam[],
  ): Promise<{ text: string; content: unknown[] }> {
    let response: Anthropic.Beta.BetaMessage;

    try {
      response = await this.client!.beta.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: EFFORT },
        system,
        messages,
        // `fallbacks` isn't typed in the installed SDK (0.88) yet; the SDK
        // sends request params as-is, so it reaches the API unchanged.
        ...(SUPPORTS_FALLBACKS
          ? { betas: [FALLBACK_BETA], ...({ fallbacks: 'default' } as object) }
          : {}),
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    } catch (err) {
      if (
        err instanceof Anthropic.RateLimitError ||
        err instanceof Anthropic.InternalServerError ||
        err instanceof Anthropic.APIConnectionError
      ) {
        this.logger.warn(`Assistant temporarily unavailable: ${err.message}`);
        throw new HttpException(
          'The assistant is busy right now. Please try again in a moment.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Assistant API error ${err.status}: ${err.message}`);
        throw new HttpException(
          'The assistant is unavailable right now. Please try again later.',
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw err;
    }

    const usage = response.usage as any;
    this.logger.log(
      `Assistant reply by ${response.model}: stop=${response.stop_reason} ` +
      `in=${usage?.input_tokens} cacheRead=${usage?.cache_read_input_tokens} ` +
      `cacheWrite=${usage?.cache_creation_input_tokens} out=${usage?.output_tokens}`,
    );

    // Check stop_reason before reading content: a refusal can arrive with
    // HTTP 200 and no usable answer (the whole fallback chain declined).
    if ((response.stop_reason as string) === 'refusal') {
      return { text: REFUSAL_REPLY, content: [{ type: 'text', text: REFUSAL_REPLY }] };
    }

    const content = this.prepareForReplay(response.content as unknown[]);
    const text = content
      .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n\n')
      .trim();

    if (!text) {
      this.logger.error(`Assistant returned no text (stop=${response.stop_reason})`);
      throw new HttpException(
        "The assistant couldn't answer that right now. Please try again.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    return { text, content };
  }

  /**
   * Make an assistant turn safe to send back on later requests. If a fallback
   * happened, the API marks it with a `fallback` block; thinking and tool
   * blocks produced before that point by the declined model must not be
   * echoed. The marker itself is an ignored audit block, so it's dropped too.
   */
  private prepareForReplay(content: unknown[]): unknown[] {
    const types = content.map((b: any) => b?.type);
    const lastFallback = types.lastIndexOf('fallback');

    return content.filter((block: any, i) => {
      if (block?.type === 'fallback') return false;
      if (
        i < lastFallback &&
        ['thinking', 'redacted_thinking', 'tool_use'].includes(block?.type)
      ) {
        return false;
      }
      return true;
    });
  }

  private async assertWithinDailyLimit(userId: string, userType: AssistantUserType): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [result] = await this.conversationModel.aggregate([
      { $match: { user: new Types.ObjectId(userId), userType, lastMessageAt: { $gte: since } } },
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'user', 'messages.createdAt': { $gte: since } } },
      { $count: 'count' },
    ]);

    if ((result?.count ?? 0) >= this.dailyMessageLimit) {
      throw new HttpException(
        `You've reached the limit of ${this.dailyMessageLimit} assistant messages in 24 hours. Please try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async findOwnConversation(
    conversationId: string,
    userId: string,
    userType: AssistantUserType,
  ): Promise<AssistantConversationDocument> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException('Conversation not found');
    }

    // Scoped by owner in the query itself: someone else's chat reads as not found.
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      user: new Types.ObjectId(userId),
      userType,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private buildTitle(message: string): string {
    const oneLine = message.replace(/\s+/g, ' ').trim();
    return oneLine.length > TITLE_MAX_LENGTH
      ? `${oneLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
      : oneLine;
  }

  private toView(m: AssistantMessage & { _id?: Types.ObjectId }): AssistantMessageView {
    return { _id: m._id!, role: m.role, text: m.text, createdAt: m.createdAt };
  }
}
