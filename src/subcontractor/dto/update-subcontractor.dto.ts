import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { PrimaryTrade } from '../schema/subcontractor.schema';

export class UpdateSubcontractorDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsEnum(PrimaryTrade)
    primaryTrade?: PrimaryTrade;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsNumber()
    hourlyRate?: number;

    @IsOptional()
    @IsString()
    professionalBio?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    availability?: boolean;

    @IsOptional()
    @IsString()
    postcode?: string;

    @IsOptional()
    @IsString()
    cityLocation?: string;

    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @IsOptional()
    @IsString()
    newPassword?: string;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsNumber()
    yearsOfExperience?: number;

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return value; }
        }
        return value;
    })
    insurance?: { documents?: string[]; expiresAt?: Date };

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return value; }
        }
        return value;
    })
    tickets?: { documents?: string[]; expiresAt?: Date };

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return value; }
        }
        return value;
    })
    certification?: { documents?: string[]; expiresAt?: Date };

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    jobAlerts?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    timesheetReminders?: boolean;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsNumber()
    @IsIn([20, 30])
    cisDeductionRate?: 20 | 30;
}
