import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PrimaryTrade } from '../../subcontractor/schema/subcontractor.schema';
import { PortfolioStatus } from '../schema/portfolio-item.schema';

/**
 * Normalise a list that may arrive as a JSON array, a repeated multipart field
 * (array), a single multipart field (string) or a JSON-encoded string.
 */
const toStringArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return [];
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return [value];
      }
    }
    return [value];
  }
  return value;
};

/**
 * Body for creating or editing a portfolio item. Every field is optional so
 * the form can be saved as a draft; publishing checks the required set.
 *
 * Photos are uploaded as files under the multipart field `photos`, not in this
 * body. A DTO is still required for every field because the global
 * ValidationPipe runs with forbidNonWhitelisted.
 */
export class PortfolioItemDto {
  /** "draft" for Save as Draft, "published" for Publish. Defaults to draft on create. */
  @IsOptional()
  @IsEnum(PortfolioStatus)
  status?: PortfolioStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsEnum(PrimaryTrade)
  trade?: PrimaryTrade;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  briefOverview?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  costRange?: string;

  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /**
   * Edit only. The existing photo URLs to keep, in display order. Omit to keep
   * every current photo; send an empty list to remove them all. Newly uploaded
   * files are appended after these.
   */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  keepPhotos?: string[];
}
