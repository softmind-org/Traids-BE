import {
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Trade } from '../schema/job.schema';

/**
 * Body for saving / updating a job template ("Save for Later").
 *
 * Every field is optional by design — the form can be saved half-filled. The
 * completeness check happens at publish time, not here. A DTO is still required
 * because main.ts runs a global forbidNonWhitelisted ValidationPipe, so any
 * property not declared here would 400.
 */
export class SaveJobDto {
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsEnum(Trade)
  trade?: Trade;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  siteAddress?: string;

  @IsOptional()
  @IsDateString()
  timelineStartDate?: string;

  @IsOptional()
  @IsDateString()
  timelineEndDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsArray()
  documents?: string[];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  workersRequired?: number;
}
