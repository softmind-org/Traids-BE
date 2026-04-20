import { IsString, IsNotEmpty, IsEmail, IsNumber, IsOptional, IsArray, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignUpSubcontractorDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  primaryTrade: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  yearsOfExperience?: number;

  @IsString()
  @IsNotEmpty()
  postcode: string;

  @IsString()
  @IsNotEmpty()
  cityLocation: string;

  // Flat URL field(s) from upload-document endpoint
  @IsOptional()
  insuranceDocuments?: string | string[];

  @IsOptional()
  insurance?: { expiresAt?: string };

  @IsOptional()
  ticketsDocuments?: string | string[];

  @IsOptional()
  tickets?: { expiresAt?: string };

  @IsOptional()
  certificationDocuments?: string | string[];

  @IsOptional()
  certification?: { expiresAt?: string };

  @IsOptional()
  @IsString()
  profileImage?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Transform(({ value }) => Number(value))
  hourlyRate: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  professionalBio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workExamples?: string[];
}
