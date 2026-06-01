import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { CompanySocketService } from './companySocket.service';
import { SubcontractorSocketService } from './subcontractorSocket.service';
import { NotificationModule } from '../notification/notification.module';
import { Conversation, ConversationSchema } from '../chat/schema/conversation.schema';

@Global() // Makes this module available globally without importing
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
    NotificationModule,
    MongooseModule.forFeature([{ name: Conversation.name, schema: ConversationSchema }]),
  ],
  providers: [SocketGateway, SocketService, CompanySocketService, SubcontractorSocketService],
  exports: [SocketService, SocketGateway, CompanySocketService, SubcontractorSocketService],
})
export class SocketModule { }
