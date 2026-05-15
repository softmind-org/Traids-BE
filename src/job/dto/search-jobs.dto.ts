import { IsOptional, IsString, MinLength, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchJobsDto {
  @IsString()
  @MinLength(1)
  q: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  page?: number;
}
