import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, MinLength } from 'class-validator';
import { AdminRole } from '../schema/admin.schema';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}
