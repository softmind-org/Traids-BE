import { Module } from '@nestjs/common';
import { S3UploadService } from './service/s3-upload.service';
import { EmailService } from './service/email.service';
import { OpenAiService } from './service/openai.service';

@Module({
    providers: [S3UploadService, EmailService, OpenAiService],
    exports: [S3UploadService, EmailService, OpenAiService],
})
export class CommonModule { }
