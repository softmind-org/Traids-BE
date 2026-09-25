import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { PushService } from '../push/push.service';

// Define notification types for type safety
export enum NotificationType {
  // Offer notifications
  OFFER_RECEIVED = 'offer:received',
  OFFER_ACCEPTED = 'offer:accepted',
  OFFER_REJECTED = 'offer:rejected',
  OFFER_WITHDRAWN = 'offer:withdrawn',
  OFFER_EXPIRED = 'offer:expired',

  // Job notifications
  JOB_CREATED = 'job:created',
  JOB_UPDATED = 'job:updated',
  JOB_ASSIGNED = 'job:assigned',
  JOB_COMPLETED = 'job:completed',

  // Chat notifications
  MESSAGE_RECEIVED = 'message:received',

  // General notifications
  NOTIFICATION = 'notification',
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp?: Date;
}

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);

  constructor(
    private socketGateway: SocketGateway,
    private pushService: PushService,
  ) { }

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: string, notification: NotificationPayload): void {
    const payload = {
      ...notification,
      timestamp: notification.timestamp || new Date(),
    };

    this.socketGateway.getServer().to(`user:${userId}`).emit(notification.type, payload);

    // Mobile push. Not awaited: the socket emit is the primary channel and must
    // not wait on FCM. PushService swallows its own errors.
    void this.pushService.sendToUserId(userId, {
      type: notification.type,
      title: notification.title,
      body: notification.message,
      data: notification.data,
    });

    this.logger.log(`Notification sent to user ${userId}: ${notification.type}`);
  }

  /**
   * Send notification to multiple users
   */
  sendToUsers(userIds: string[], notification: NotificationPayload): void {
    userIds.forEach((userId) => this.sendToUser(userId, notification));
  }

  /**
   * Send notification to all users of a specific type (company/subcontractor)
   */
  sendToUserType(userType: 'company' | 'subcontractor', notification: NotificationPayload): void {
    const payload = {
      ...notification,
      timestamp: notification.timestamp || new Date(),
    };

    this.socketGateway.getServer().to(`type:${userType}`).emit(notification.type, payload);

    // Mobile push
    void this.pushService.sendToUserType(userType, {
      type: notification.type,
      title: notification.title,
      body: notification.message,
      data: notification.data,
    });

    this.logger.log(`Notification sent to all ${userType}s: ${notification.type}`);
  }

  /**
   * Send notification to a specific room
   */
  sendToRoom(room: string, notification: NotificationPayload): void {
    const payload = {
      ...notification,
      timestamp: notification.timestamp || new Date(),
    };

    this.socketGateway.getServer().to(room).emit(notification.type, payload);
    this.logger.log(`Notification sent to room ${room}: ${notification.type}`);
  }

  /**
   * Broadcast notification to all connected clients
   */
  broadcast(notification: NotificationPayload): void {
    const payload = {
      ...notification,
      timestamp: notification.timestamp || new Date(),
    };

    this.socketGateway.getServer().emit(notification.type, payload);

    // Mobile push
    void this.pushService.broadcast({
      type: notification.type,
      title: notification.title,
      body: notification.message,
      data: notification.data,
    });

    this.logger.log(`Broadcast notification: ${notification.type}`);
  }

  /**
   * Check if a user is currently online
   */
  isUserOnline(userId: string): boolean {
    return this.socketGateway.isUserOnline(userId);
  }

  /**
   * Get list of all online users
   */
  getOnlineUsers(): string[] {
    return this.socketGateway.getOnlineUsers();
  }
}
