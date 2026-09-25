import { IsString, IsNotEmpty, IsEmail, IsOptional, IsArray, MinLength } from 'class-validator';

export class SignUpCompanyDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  registrationNumber: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsString()
  @IsNotEmpty()
  industryType: string;

  @IsString()
  @IsNotEmpty()
  primaryContactName: string;

  @IsEmail()
  @IsNotEmpty()
  workEmail: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  headOfficeAddress: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyDocuments?: string[];

  @IsOptional()
  @IsString()
  insuranceCertificate?: string;

  @IsOptional()
  @IsString()
  healthAndSafetyPolicy?: string;

}
