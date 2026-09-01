import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { IndustryType } from '../schema/company.schema';

export class UpdateCompanyDto {
    @IsOptional()
    @IsString()
    companyName?: string;

    @IsOptional()
    @IsString()
    registrationNumber?: string;

    @IsOptional()
    @IsString()
    vatNumber?: string;

    @IsOptional()
    @IsEnum(IndustryType)
    industryType?: IndustryType;

    @IsOptional()
    @IsString()
    aboutUs?: string;

    @IsOptional()
    @IsString()
    primaryContactName?: string;

    @IsOptional()
    @IsString()
    workEmail?: string;

    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @IsOptional()
    @IsString()
    headOfficeAddress?: string;

    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    timesheetReminders?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    removeProfileImage?: boolean;
}
