import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompanyModule } from './company/company.module';
import { SubcontractorModule } from './subcontractor/subcontractor.module';
import { AuthModule } from './auth/auth.module';
import { JobModule } from './job/job.module';
import { OfferModule } from './offer/offer.module';
import { SocketModule } from './socket/socket.module';
import { Logger } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { JobApplicationModule } from './job-application/job-application.module';
import { ComplianceModule } from './compliance/compliance.module';
import { NotificationModule } from './notification/notification.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { InvoiceModule } from './invoice/invoice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/traids', {
      connectionFactory: (connection) => {
        connection.on('connected', () => {
          Logger.log('MongoDB connected successfully', 'MongooseModule');
        });
        connection.on('disconnected', () => {
          Logger.warn('MongoDB disconnected', 'MongooseModule');
        });
        return connection;
      },
    }),
    SocketModule,
    CompanyModule,
    SubcontractorModule,
    AuthModule,
    JobModule,
    OfferModule,
    ChatModule,
    JobApplicationModule,
    ComplianceModule,
    NotificationModule,
    SchedulerModule,
    TimesheetModule,
    InvoiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

