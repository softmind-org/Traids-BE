import {
  Injectable,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { BioSearch, BioSearchDocument } from './schema/bio-search.schema';
import {
  Subcontractor,
  SubcontractorDocument,
  PrimaryTrade,
} from '../subcontractor/schema/subcontractor.schema';
import { ASSISTANT_ANTHROPIC_CLIENT } from '../assistant/assistant.service';

const MODEL = process.env.BIO_ANALYSER_MODEL || process.env.ASSISTANT_MODEL || 'claude-sonnet-5';

/** How many candidates are scored by Claude, and how many are returned. */
const SHORTLIST_SIZE = 30;
const RESULT_SIZE = 5;

/**
 * Weights for the three things a match is scored on. A dimension the company
 * didn't mention (e.g. no budget given) is dropped and the rest are
 * rebalanced, so no bar shows an invented number.
 */
const WEIGHTS = { projectType: 50, ratings: 25, budget: 25 };

const TIERS: { min: number; tier: string }[] = [
  { min: 90, tier: 'Top Match' },
  { min: 80, tier: 'Strong' },
  { min: 70, tier: 'Good' },
  { min: 0, tier: 'Fair' },
];

/** Neutral score for a subcontractor nobody has rated yet — no boost, no penalty. */
const UNRATED_SCORE = 60;
/** Ratings count at which the rating is trusted in full. */
const RATING_CONFIDENCE_AT = 5;

const CRITERIA_SCHEMA = {
  type: 'object',
  properties: {
    projectType: {
      type: 'string',
      description: 'The work being described, e.g. "commercial office rewire". Empty string if unclear.',
    },
    // An enum can't be combined with a union type ("['string','null']") — the
    // API rejects that schema — so the nullable case goes through anyOf.
    trade: {
      anyOf: [
        { type: 'string', enum: ['electrician', 'plumber', 'carpenter', 'masonry'] },
        { type: 'null' },
      ],
      description: 'Only if clearly implied by the request.',
    },
    location: { type: ['string', 'null'], description: 'Town or city named in the request.' },
    budgetMin: { type: ['number', 'null'], description: 'Lowest hourly rate in £, if a budget is given.' },
    budgetMax: { type: ['number', 'null'], description: 'Highest hourly rate in £, if a budget is given.' },
    availableOnly: { type: 'boolean', description: 'True only if they ask for available subcontractors.' },
    summary: { type: 'string', description: 'Short label for the search, e.g. "Senior Electrician".' },
  },
  required: ['projectType', 'trade', 'location', 'budgetMin', 'budgetMax', 'availableOnly', 'summary'],
  additionalProperties: false,
} as const;

const SCORES_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          // minimum/maximum aren't supported on integers in output schemas —
          // the range is stated here and clamped in code.
          projectTypeMatch: {
            type: 'integer',
            description: 'How well their experience fits this project type, from 0 to 100.',
          },
          reason: { type: 'string', description: 'One short sentence citing evidence from their bio.' },
        },
        required: ['id', 'projectTypeMatch', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['scores'],
  additionalProperties: false,
} as const;

export interface BioSearchCriteria {
  projectType: string;
  trade: PrimaryTrade | null;
  location: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  availableOnly: boolean;
  summary: string;
}

@Injectable()
export class BioAnalyserService {
  private readonly logger = new Logger(BioAnalyserService.name);
  private readonly dailySearchLimit = Number(process.env.BIO_ANALYSER_DAILY_LIMIT) || 50;

  constructor(
    @InjectModel(BioSearch.name) private bioSearchModel: Model<BioSearchDocument>,
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
    @Inject(ASSISTANT_ANTHROPIC_CLIENT) private readonly client: Anthropic | null,
  ) { }

  // ─────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────

  async search(companyId: string, message: string, conversationId?: string) {
    if (!this.client) {
      throw new HttpException(
        'The Bio Analyser is unavailable right now. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const conversation = conversationId
      ? await this.findOwnSearch(conversationId, companyId)
      : null;

    await this.assertWithinDailyLimit(companyId);

    // A refinement ("only in Manchester") is read together with what came
    // before, so earlier requirements aren't lost.
    const previous = conversation?.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.text) ?? [];

    const criteria = await this.understandRequest([...previous, message]);
    const candidates = await this.shortlist(criteria);

    let results: any[] = [];
    if (candidates.length > 0) {
      const scored = await this.scoreProjectTypeFit(criteria, candidates);
      results = this.rank(criteria, candidates, scored);
    }

    const summary = results.length
      ? `Showing ${results.length} matching subcontractor${results.length === 1 ? '' : 's'} for ${criteria.summary || criteria.projectType}`
      : 'No matching subcontractors found. Try widening the trade, location or budget.';

    const now = new Date();
    const userMessage = { role: 'user' as const, text: message, createdAt: now };
    const assistantMessage = {
      role: 'assistant' as const,
      text: summary,
      criteria,
      results,
      createdAt: new Date(now.getTime() + 1),
    };

    let saved: BioSearchDocument | null;
    if (conversation) {
      saved = await this.bioSearchModel.findOneAndUpdate(
        { _id: conversation._id, company: new Types.ObjectId(companyId) },
        {
          $push: { messages: { $each: [userMessage, assistantMessage] } },
          $set: { lastMessageAt: assistantMessage.createdAt },
        },
        { new: true },
      );
      if (!saved) throw new NotFoundException('Search not found');
    } else {
      saved = await this.bioSearchModel.create({
        company: new Types.ObjectId(companyId),
        title: criteria.summary || message.slice(0, 60),
        messages: [userMessage, assistantMessage],
        lastMessageAt: assistantMessage.createdAt,
      });
    }

    return {
      conversationId: saved._id,
      title: saved.title,
      isNewSearch: !conversation,
      criteria,
      summary,
      count: results.length,
      results,
    };
  }

  async listSearches(companyId: string) {
    return this.bioSearchModel.aggregate([
      { $match: { company: new Types.ObjectId(companyId) } },
      { $sort: { lastMessageAt: -1 } },
      { $limit: 100 },
      { $project: { title: 1, createdAt: 1, lastMessageAt: 1, searchCount: { $size: '$messages' } } },
    ]);
  }

  async getSearch(conversationId: string, companyId: string) {
    const search = await this.findOwnSearch(conversationId, companyId);
    const lastAssistant = [...search.messages].reverse().find((m) => m.role === 'assistant');

    return {
      _id: search._id,
      title: search.title,
      createdAt: (search as any).createdAt,
      lastMessageAt: search.lastMessageAt,
      messages: search.messages.map((m) => ({
        _id: (m as any)._id,
        role: m.role,
        text: m.text,
        createdAt: m.createdAt,
      })),
      // The most recent results, so reopening a search shows its cards again.
      criteria: lastAssistant?.criteria ?? null,
      results: lastAssistant?.results ?? [],
    };
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — UNDERSTAND THE REQUEST
  // ─────────────────────────────────────────────────────────────

  private async understandRequest(messages: string[]): Promise<BioSearchCriteria> {
    const prompt =
      messages.length > 1
        ? `A company is searching for subcontractors on a UK construction platform. Read their requests in order — later ones refine earlier ones — and extract the combined requirements.\n\n${messages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
        : `A company is searching for subcontractors on a UK construction platform. Extract what they are looking for.\n\n${messages[0]}`;

    const parsed = await this.askForJson<BioSearchCriteria>(
      'You extract search requirements. Only fill in a field if the request genuinely says or clearly implies it; otherwise use null. Rates are hourly and in pounds.',
      prompt,
      CRITERIA_SCHEMA,
      1024,
    );

    return {
      projectType: parsed.projectType || '',
      trade: parsed.trade ?? null,
      location: parsed.location ?? null,
      budgetMin: parsed.budgetMin ?? null,
      budgetMax: parsed.budgetMax ?? null,
      availableOnly: !!parsed.availableOnly,
      summary: parsed.summary || parsed.projectType || 'your project',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — SHORTLIST FROM THE DATABASE
  // ─────────────────────────────────────────────────────────────

  private async shortlist(criteria: BioSearchCriteria): Promise<SubcontractorDocument[]> {
    const query: any = {};
    if (criteria.trade) query.primaryTrade = criteria.trade;
    if (criteria.availableOnly) query.availability = true;
    if (criteria.location) {
      const escaped = criteria.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { cityLocation: { $regex: escaped, $options: 'i' } },
        { postcode: { $regex: escaped, $options: 'i' } },
      ];
    }

    const find = () =>
      this.subcontractorModel
        .find(query)
        .select('fullName profileImage primaryTrade yearsOfExperience cityLocation postcode hourlyRate availability professionalBio averageRating totalRatings')
        .sort({ averageRating: -1, totalRatings: -1 })
        .limit(SHORTLIST_SIZE)
        .exec();

    let candidates = await find();

    // A location nobody matches shouldn't return nothing — drop it and let the
    // trade filter stand, rather than showing an empty screen.
    if (candidates.length === 0 && criteria.location) {
      delete query.$or;
      candidates = await find();
    }

    return candidates;
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3 — SCORE PROJECT-TYPE FIT (the AI part)
  // ─────────────────────────────────────────────────────────────

  private async scoreProjectTypeFit(
    criteria: BioSearchCriteria,
    candidates: SubcontractorDocument[],
  ): Promise<Map<string, { projectTypeMatch: number; reason: string }>> {
    // Only what's needed to judge fit — never email, phone or documents.
    const profiles = candidates.map((c) => ({
      id: c._id.toString(),
      trade: c.primaryTrade,
      yearsOfExperience: c.yearsOfExperience ?? null,
      bio: (c.professionalBio || '').slice(0, 800) || 'No bio provided.',
    }));

    const parsed = await this.askForJson<{ scores: { id: string; projectTypeMatch: number; reason: string }[] }>(
      'You score how well each subcontractor fits a described construction project, based only on their trade, experience and bio. Score every candidate given. Be honest: a weak or missing bio should score low, and no bio is not evidence of skill.',
      `Project: ${criteria.projectType || criteria.summary}\n\nCandidates:\n${JSON.stringify(profiles, null, 1)}`,
      SCORES_SCHEMA,
      4096,
    );

    const map = new Map<string, { projectTypeMatch: number; reason: string }>();
    for (const s of parsed.scores ?? []) {
      map.set(String(s.id), {
        projectTypeMatch: Math.max(0, Math.min(100, Math.round(s.projectTypeMatch))),
        reason: s.reason,
      });
    }
    return map;
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4 — RANK
  // ─────────────────────────────────────────────────────────────

  private rank(
    criteria: BioSearchCriteria,
    candidates: SubcontractorDocument[],
    scored: Map<string, { projectTypeMatch: number; reason: string }>,
  ) {
    const hasBudget = criteria.budgetMin != null || criteria.budgetMax != null;

    const results = candidates.map((c) => {
      const ai = scored.get(c._id.toString());
      const projectType = ai?.projectTypeMatch ?? 0;
      const ratings = this.ratingScore(c.averageRating, c.totalRatings);
      const budget = hasBudget ? this.budgetScore(c.hourlyRate, criteria) : null;

      // Drop the budget dimension when no budget was given and rebalance.
      const parts: [number, number][] = [
        [projectType, WEIGHTS.projectType],
        [ratings, WEIGHTS.ratings],
        ...(budget !== null ? ([[budget, WEIGHTS.budget]] as [number, number][]) : []),
      ];
      const totalWeight = parts.reduce((a, [, w]) => a + w, 0);
      const fitScore = Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / totalWeight);

      return {
        subcontractor: {
          _id: c._id,
          fullName: c.fullName,
          profileImage: c.profileImage ?? null,
          primaryTrade: c.primaryTrade,
          yearsOfExperience: c.yearsOfExperience ?? null,
          cityLocation: c.cityLocation,
          hourlyRate: c.hourlyRate,
          availability: c.availability,
          averageRating: c.averageRating ?? 0,
          totalRatings: c.totalRatings ?? 0,
        },
        fitScore,
        tier: TIERS.find((t) => fitScore >= t.min)!.tier,
        breakdown: { projectType, ratings, budget },
        reason: ai?.reason ?? '',
      };
    });

    return results.sort((a, b) => b.fitScore - a.fitScore).slice(0, RESULT_SIZE);
  }

  /**
   * Star rating as a percentage, pulled towards neutral when few people have
   * rated them — one 5-star review shouldn't outrank a solid long record.
   */
  private ratingScore(averageRating?: number, totalRatings?: number): number {
    const count = totalRatings ?? 0;
    if (!averageRating || count === 0) return UNRATED_SCORE;

    const confidence = Math.min(1, count / RATING_CONFIDENCE_AT);
    const raw = (averageRating / 5) * 100;
    return Math.round(UNRATED_SCORE + (raw - UNRATED_SCORE) * confidence);
  }

  /** Full marks inside budget; falls away the further over it they are. */
  private budgetScore(hourlyRate: number, criteria: BioSearchCriteria): number {
    const { budgetMax } = criteria;

    if (budgetMax != null && hourlyRate > budgetMax) {
      const overBy = (hourlyRate - budgetMax) / budgetMax;
      return Math.max(0, Math.round(100 - overBy * 200)); // 10% over ≈ 80
    }
    // Under the stated minimum is not a problem for the buyer, so no penalty.
    return 100;
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  /** One Claude call that must return JSON matching the given schema. */
  private async askForJson<T>(
    system: string,
    prompt: string,
    schema: object,
    maxTokens: number,
  ): Promise<T> {
    try {
      const response = await this.client!.beta.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        system,
        messages: [{ role: 'user', content: prompt }],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);

      const usage = response.usage as any;
      this.logger.log(
        `Bio Analyser call (${MODEL}): stop=${response.stop_reason} in=${usage?.input_tokens} out=${usage?.output_tokens}`,
      );

      if ((response.stop_reason as string) === 'refusal') {
        throw new HttpException(
          "Sorry, that search can't be processed. Please rephrase it.",
          HttpStatus.BAD_REQUEST,
        );
      }

      const text = (response.content as any[])
        .filter((b) => b?.type === 'text')
        .map((b) => b.text)
        .join('');

      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if (
        err instanceof Anthropic.RateLimitError ||
        err instanceof Anthropic.InternalServerError ||
        err instanceof Anthropic.APIConnectionError
      ) {
        this.logger.warn(`Bio Analyser temporarily unavailable: ${err.message}`);
        throw new HttpException(
          'The Bio Analyser is busy right now. Please try again in a moment.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Bio Analyser API error ${err.status}: ${err.message}`);
      } else {
        this.logger.error(`Bio Analyser failed: ${err.message}`);
      }
      throw new HttpException(
        'The Bio Analyser is unavailable right now. Please try again later.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async assertWithinDailyLimit(companyId: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [result] = await this.bioSearchModel.aggregate([
      { $match: { company: new Types.ObjectId(companyId), lastMessageAt: { $gte: since } } },
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'user', 'messages.createdAt': { $gte: since } } },
      { $count: 'count' },
    ]);

    if ((result?.count ?? 0) >= this.dailySearchLimit) {
      throw new HttpException(
        `You've reached the limit of ${this.dailySearchLimit} Bio Analyser searches in 24 hours. Please try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async findOwnSearch(conversationId: string, companyId: string): Promise<BioSearchDocument> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException('Search not found');
    }
    const search = await this.bioSearchModel.findOne({
      _id: new Types.ObjectId(conversationId),
      company: new Types.ObjectId(companyId),
    });
    if (!search) throw new NotFoundException('Search not found');
    return search;
  }
}
