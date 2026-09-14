import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PortfolioItem,
  PortfolioItemDocument,
  PortfolioStatus,
} from './schema/portfolio-item.schema';
import {
  Subcontractor,
  SubcontractorDocument,
} from '../subcontractor/schema/subcontractor.schema';
import { PortfolioItemDto } from './dto/portfolio-item.dto';
import { S3UploadService } from '../common/service/s3-upload.service';
import { RatingService } from '../rating/rating.service';

export const MAX_PORTFOLIO_PHOTOS = 10;

/** Fields a portfolio item must have before it can be published. */
const REQUIRED_TO_PUBLISH = ['title', 'trade', 'briefOverview', 'photos'] as const;

/** A certificate is "expiring soon" within this many days of its expiry date. */
const EXPIRING_SOON_DAYS = 30;

/** "Top Rated" badge threshold. */
const TOP_RATED_MIN_AVERAGE = 4.5;
const TOP_RATED_MIN_RATINGS = 3;

export type CertificateStatus =
  | 'missing'
  | 'valid'
  | 'no_expiry'
  | 'expiring_soon'
  | 'expired';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectModel(PortfolioItem.name)
    private portfolioModel: Model<PortfolioItemDocument>,
    @InjectModel(Subcontractor.name)
    private subcontractorModel: Model<SubcontractorDocument>,
    private s3UploadService: S3UploadService,
    private ratingService: RatingService,
  ) { }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Content fields from the DTO, skipping anything omitted so an edit never
   * blanks a field that was already filled in.
   */
  private buildContentPatch(dto: PortfolioItemDto): Record<string, any> {
    const patch: Record<string, any> = {};

    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.trade !== undefined) patch.trade = dto.trade;
    if (dto.briefOverview !== undefined) patch.briefOverview = dto.briefOverview;
    if (dto.clientName !== undefined) patch.clientName = dto.clientName;
    if (dto.location !== undefined) patch.location = dto.location;
    if (dto.duration !== undefined) patch.duration = dto.duration;
    if (dto.costRange !== undefined) patch.costRange = dto.costRange;
    if (dto.completionDate !== undefined) {
      patch.completionDate = new Date(dto.completionDate);
    }
    if (dto.description !== undefined) patch.description = dto.description;

    return patch;
  }

  /**
   * Throw a 400 listing every missing field if the item isn't publishable.
   * Runs BEFORE uploading, against the photo count the item will end up with,
   * so a rejected publish doesn't leave orphaned files in S3.
   */
  private assertPublishable(content: Record<string, any>, photoCount: number): void {
    const missing = REQUIRED_TO_PUBLISH.filter((field) => {
      if (field === 'photos') return photoCount === 0;
      const value = content[field];
      return value === undefined || value === null || String(value).trim() === '';
    });

    if (missing.length > 0) {
      throw new HttpException(
        {
          message: `Cannot publish — missing required fields: ${missing.join(', ')}`,
          missingFields: missing,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertPhotoLimit(photoCount: number): void {
    if (photoCount > MAX_PORTFOLIO_PHOTOS) {
      throw new HttpException(
        `A portfolio item can have at most ${MAX_PORTFOLIO_PHOTOS} photos`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async uploadPhotos(files?: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];
    return this.s3UploadService.uploadMultipleFiles(files, 'subcontractors/portfolio');
  }

  private certificateStatus(
    cert: { documents?: string[]; expiresAt?: Date | null } | undefined,
    now: Date,
  ): CertificateStatus {
    if (!cert?.documents || cert.documents.length === 0) return 'missing';
    if (!cert.expiresAt) return 'no_expiry';

    const expiresAt = new Date(cert.expiresAt);
    if (expiresAt.getTime() < now.getTime()) return 'expired';

    const soon = new Date(now);
    soon.setDate(soon.getDate() + EXPIRING_SOON_DAYS);
    if (expiresAt.getTime() <= soon.getTime()) return 'expiring_soon';

    return 'valid';
  }

  // ─────────────────────────────────────────────────────────────
  // SUBCONTRACTOR — OWN PORTFOLIO
  // ─────────────────────────────────────────────────────────────

  async createItem(
    dto: PortfolioItemDto,
    subcontractorId: string,
    files?: Express.Multer.File[],
  ): Promise<PortfolioItemDocument> {
    if (dto.keepPhotos !== undefined) {
      throw new HttpException(
        'keepPhotos only applies when editing an existing item',
        HttpStatus.BAD_REQUEST,
      );
    }

    const status = dto.status ?? PortfolioStatus.DRAFT;
    const content = this.buildContentPatch(dto);
    const photoCount = files?.length ?? 0;

    this.assertPhotoLimit(photoCount);
    if (status === PortfolioStatus.PUBLISHED) {
      this.assertPublishable(content, photoCount);
    }

    const photos = await this.uploadPhotos(files);

    const item = new this.portfolioModel({
      subcontractor: new Types.ObjectId(subcontractorId),
      ...content,
      photos,
      status,
      publishedAt: status === PortfolioStatus.PUBLISHED ? new Date() : undefined,
    });

    return item.save();
  }

  async getOwnItems(subcontractorId: string): Promise<PortfolioItemDocument[]> {
    return this.portfolioModel
      .find({ subcontractor: new Types.ObjectId(subcontractorId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getOwnItem(
    itemId: string,
    subcontractorId: string,
  ): Promise<PortfolioItemDocument> {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new HttpException('Portfolio item not found', HttpStatus.NOT_FOUND);
    }

    const item = await this.portfolioModel.findById(itemId);

    if (!item) {
      throw new HttpException('Portfolio item not found', HttpStatus.NOT_FOUND);
    }
    if (item.subcontractor.toString() !== subcontractorId) {
      throw new HttpException(
        'You do not have permission to access this portfolio item',
        HttpStatus.FORBIDDEN,
      );
    }

    return item;
  }

  async updateItem(
    itemId: string,
    dto: PortfolioItemDto,
    subcontractorId: string,
    files?: Express.Multer.File[],
  ): Promise<PortfolioItemDocument> {
    const item = await this.getOwnItem(itemId, subcontractorId);

    // Only keep URLs that already belong to this item — the client cannot
    // attach arbitrary URLs through keepPhotos.
    const keptPhotos =
      dto.keepPhotos === undefined
        ? item.photos
        : dto.keepPhotos.filter((url) => item.photos.includes(url));

    const photoCount = keptPhotos.length + (files?.length ?? 0);
    this.assertPhotoLimit(photoCount);

    const nextStatus = dto.status ?? item.status;
    const content = this.buildContentPatch(dto);

    if (nextStatus === PortfolioStatus.PUBLISHED) {
      // Validate the item as it WILL be after this edit.
      const merged = { ...item.toObject(), ...content };
      this.assertPublishable(merged, photoCount);
    }

    const newPhotos = await this.uploadPhotos(files);

    Object.assign(item, content);
    item.photos = [...keptPhotos, ...newPhotos];

    if (nextStatus !== item.status) {
      item.status = nextStatus;
      // Stamp the first publish; moving back to draft keeps the history.
      if (nextStatus === PortfolioStatus.PUBLISHED && !item.publishedAt) {
        item.publishedAt = new Date();
      }
    }

    return item.save();
  }

  async deleteItem(itemId: string, subcontractorId: string): Promise<void> {
    await this.getOwnItem(itemId, subcontractorId);
    await this.portfolioModel.findByIdAndDelete(itemId).exec();
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC (company-facing)
  // ─────────────────────────────────────────────────────────────

  /** Published items only — drafts are never exposed to companies. */
  async getPublishedItems(subcontractorId: string): Promise<PortfolioItemDocument[]> {
    return this.portfolioModel
      .find({
        subcontractor: new Types.ObjectId(subcontractorId),
        status: PortfolioStatus.PUBLISHED,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  // ─────────────────────────────────────────────────────────────
  // PROFILE OVERVIEW
  // ─────────────────────────────────────────────────────────────

  /**
   * Everything the subcontractor's Profile Overview page renders, in one call:
   * profile card, certificates with a computed status, own portfolio (drafts
   * included) and reviews.
   */
  async getProfileOverview(subcontractorId: string) {
    const subcontractor = await this.subcontractorModel
      .findById(subcontractorId)
      .select(
        'fullName email profileImage primaryTrade hourlyRate availability professionalBio yearsOfExperience cityLocation averageRating totalRatings insurance tickets certification',
      )
      .lean();

    if (!subcontractor) {
      throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
    }

    const [portfolio, reviews] = await Promise.all([
      this.getOwnItems(subcontractorId),
      this.ratingService.getSubcontractorRatings(subcontractorId),
    ]);

    const now = new Date();
    const certificate = (cert: any) => ({
      documents: cert?.documents ?? [],
      expiresAt: cert?.expiresAt ?? null,
      status: this.certificateStatus(cert, now),
    });

    const averageRating = subcontractor.averageRating ?? 0;
    const totalRatings = subcontractor.totalRatings ?? 0;

    return {
      profile: {
        _id: subcontractor._id,
        fullName: subcontractor.fullName,
        email: subcontractor.email,
        profileImage: subcontractor.profileImage ?? null,
        primaryTrade: subcontractor.primaryTrade,
        hourlyRate: subcontractor.hourlyRate,
        availability: subcontractor.availability,
        professionalBio: subcontractor.professionalBio ?? null,
        yearsOfExperience: subcontractor.yearsOfExperience ?? null,
        cityLocation: subcontractor.cityLocation,
        averageRating,
        totalRatings,
        topRated:
          averageRating >= TOP_RATED_MIN_AVERAGE &&
          totalRatings >= TOP_RATED_MIN_RATINGS,
      },
      certificates: {
        insurance: certificate(subcontractor.insurance),
        tickets: certificate(subcontractor.tickets),
        certification: certificate(subcontractor.certification),
      },
      portfolio,
      reviews,
    };
  }
}
