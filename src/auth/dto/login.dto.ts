import { IsEmail, IsNotEmpty, IsString, IsIn, IsOptional, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['company', 'subcontractor'])
  userType: 'company' | 'subcontractor';

  /** Mobile only. Sent on every login; stored if it isn't already on the user. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fcmToken?: string;
}
