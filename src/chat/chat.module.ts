import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { SocketService } from '../socket/socket.service';
import { ChatController } from './chat.controller';
import { Conversation, ConversationSchema } from './schema/conversation.schema';
import { Message, MessageSchema } from './schema/message.schema';
import { Subcontractor, SubcontractorSchema } from '../subcontractor/schema/subcontractor.schema';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Job.name, schema: JobSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
    CommonModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, SocketService],
  exports: [ChatService],
})
export class ChatModule { }
