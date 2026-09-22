import { IsString, IsNotEmpty, IsOptional, IsMongoId, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class BioSearchDto {
  /** What the company is looking for, in their own words. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  /** Omit to start a new search; send an id to refine that one. */
  @IsOptional()
  @IsMongoId()
  conversationId?: string;
}
