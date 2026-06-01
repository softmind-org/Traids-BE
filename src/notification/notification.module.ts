import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification, NotificationSchema } from './schema/notification.schema';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
        ]),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            signOptions: { expiresIn: '24h' },
        }),
    ],
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule { }
