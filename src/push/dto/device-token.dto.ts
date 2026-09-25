import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fcmToken: string;
}
