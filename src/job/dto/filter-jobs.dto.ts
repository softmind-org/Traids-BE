import { IsOptional, IsEnum, IsNumber, IsString, IsDateString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { Trade } from '../schema/job.schema';

export class FilterJobsDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(Trade, { each: true })
  trade?: Trade[];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  maxHourlyRate?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  page?: number;
}
