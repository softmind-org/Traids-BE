import { IsString, IsNotEmpty, IsOptional, IsMongoId, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendAssistantMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  /** Omit to start a new chat; send an existing id to continue that chat. */
  @IsOptional()
  @IsMongoId()
  conversationId?: string;
}
