import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../push/push.service';

@Injectable()
export class SubcontractorSocketService {
    private readonly logger = new Logger(SubcontractorSocketService.name);

    constructor(
        private socketGateway: SocketGateway,
        private notificationService: NotificationService,
        private pushService: PushService,
    ) { }

    /**
     * Notify subcontractor that application was accepted
     */
    async notifyApplicationAccepted(
        subcontractorId: string,
        applicationData: {
            applicationId: string;
            jobId: string;
            message?: string;
            companyId: string;
            companyName: string;
        },
    ): Promise<void> {
        // Emit socket event
        this.socketGateway.getServer()
            .to(`user:${subcontractorId}`)
            .emit('applicationAccepted', {
                applicationId: applicationData.applicationId,
                jobId: applicationData.jobId,
                message: applicationData.message,
            });

        // Create notification in database
        await this.notificationService.createNotification({
            type: 'applicationAccepted',
            title: 'Application Accepted',
            message: applicationData.message || 'Your job application has been accepted',
            senderId: applicationData.companyId,
            senderType: 'company',
            senderName: applicationData.companyName,
            receiverId: subcontractorId,
            receiverType: 'subcontractor',
            relatedEntityId: applicationData.applicationId,
            relatedEntityType: 'application',
            data: { jobId: applicationData.jobId },
        });

        // Mobile push
        await this.pushService.sendToUser(subcontractorId, 'subcontractor', {
            type: 'applicationAccepted',
            title: 'Application Accepted',
            body: applicationData.message || 'Your job application has been accepted',
            data: {
                applicationId: applicationData.applicationId,
                jobId: applicationData.jobId,
                companyId: applicationData.companyId,
            },
        });

        this.logger.log(`Application accepted notification sent to subcontractor ${subcontractorId}`);
    }

    /**
     * Notify subcontractor that application was rejected
     */
    async notifyApplicationRejected(
        subcontractorId: string,
        applicationData: {
            applicationId: string;
            jobId: string;
            message?: string;
            companyId: string;
            companyName: string;
        },
    ): Promise<void> {
        // Emit socket event
        this.socketGateway.getServer()
            .to(`user:${subcontractorId}`)
            .emit('applicationRejected', {
                applicationId: applicationData.applicationId,
                jobId: applicationData.jobId,
                message: applicationData.message,
            });

        // Create notification in database
        await this.notificationService.createNotification({
            type: 'applicationRejected',
            title: 'Application Rejected',
            message: applicationData.message || 'Your job application has been rejected',
            senderId: applicationData.companyId,
            senderType: 'company',
            senderName: applicationData.companyName,
            receiverId: subcontractorId,
            receiverType: 'subcontractor',
            relatedEntityId: applicationData.applicationId,
            relatedEntityType: 'application',
            data: { jobId: applicationData.jobId },
        });

        // Mobile push
        await this.pushService.sendToUser(subcontractorId, 'subcontractor', {
            type: 'applicationRejected',
            title: 'Application Rejected',
            body: applicationData.message || 'Your job application has been rejected',
            data: {
                applicationId: applicationData.applicationId,
                jobId: applicationData.jobId,
                companyId: applicationData.companyId,
            },
        });

        this.logger.log(`Application rejected notification sent to subcontractor ${subcontractorId}`);
    }

    /**
     * Notify subcontractor about new job offer
     */
    async notifyOfferReceived(
        subcontractorId: string,
        offerData: {
            offerId: string;
            jobTitle: string;
            companyName: string;
            companyId: string;
            hourlyRate: number;
        },
    ): Promise<void> {
        // Emit socket event
        this.socketGateway.getServer()
            .to(`user:${subcontractorId}`)
            .emit('offerReceived', {
                offerId: offerData.offerId,
                jobTitle: offerData.jobTitle,
                companyName: offerData.companyName,
                hourlyRate: offerData.hourlyRate,
            });

        // Create notification in database
        await this.notificationService.createNotification({
            type: 'offerReceived',
            title: 'New Job Offer',
            message: `${offerData.companyName} sent you an offer for ${offerData.jobTitle}`,
            senderId: offerData.companyId,
            senderType: 'company',
            senderName: offerData.companyName,
            receiverId: subcontractorId,
            receiverType: 'subcontractor',
            relatedEntityId: offerData.offerId,
            relatedEntityType: 'offer',
            data: {
                jobTitle: offerData.jobTitle,
                hourlyRate: offerData.hourlyRate,
            },
        });

        // Mobile push
        await this.pushService.sendToUser(subcontractorId, 'subcontractor', {
            type: 'offerReceived',
            title: 'New Job Offer',
            body: `${offerData.companyName} sent you an offer for ${offerData.jobTitle}`,
            data: {
                offerId: offerData.offerId,
                companyId: offerData.companyId,
                hourlyRate: offerData.hourlyRate,
            },
        });

        this.logger.log(`Offer received notification sent to subcontractor ${subcontractorId}`);
    }

    /**
     * Notify subcontractor about new message
     */
    async notifyNewMessage(
        subcontractorId: string,
        messageData: {
            conversationId: string;
            senderId: string;
            senderName: string;
            preview: string;
            messageId?: string;
        },
    ): Promise<void> {
        // Emit socket event
        this.socketGateway.getServer()
            .to(`user:${subcontractorId}`)
            .emit('newMessage', {
                conversationId: messageData.conversationId,
                senderId: messageData.senderId,
                senderName: messageData.senderName,
                preview: messageData.preview,
            });

        // Create notification in database
        await this.notificationService.createNotification({
            type: 'newMessage',
            title: 'New Message',
            message: `${messageData.senderName}: ${messageData.preview}`,
            senderId: messageData.senderId,
            senderType: 'company',
            senderName: messageData.senderName,
            receiverId: subcontractorId,
            receiverType: 'subcontractor',
            relatedEntityId: messageData.messageId,
            relatedEntityType: 'message',
            data: { conversationId: messageData.conversationId },
        });

        // Mobile push
        await this.pushService.sendToUser(subcontractorId, 'subcontractor', {
            type: 'newMessage',
            title: messageData.senderName,
            body: messageData.preview,
            data: {
                conversationId: messageData.conversationId,
                senderId: messageData.senderId,
                messageId: messageData.messageId,
            },
        });

        this.logger.log(`New message notification sent to subcontractor ${subcontractorId}`);
    }

    /**
     * Notify subcontractor about job assignment
     */
    async notifyJobAssigned(
        subcontractorId: string,
        jobData: {
            jobId: string;
            jobTitle: string;
            companyName: string;
        },
    ): Promise<void> {
        this.socketGateway.getServer()
            .to(`user:${subcontractorId}`)
            .emit('jobAssigned', {
                jobId: jobData.jobId,
                jobTitle: jobData.jobTitle,
                companyName: jobData.companyName,
            });

        // Mobile push
        await this.pushService.sendToUser(subcontractorId, 'subcontractor', {
            type: 'jobAssigned',
            title: 'Job Assigned',
            body: `${jobData.companyName} assigned you to ${jobData.jobTitle}`,
            data: { jobId: jobData.jobId },
        });

        this.logger.log(`Job assigned notification sent to subcontractor ${subcontractorId}`);
    }

    /**
     * Check if subcontractor is currently online
     */
    isSubcontractorOnline(subcontractorId: string): boolean {
        return this.socketGateway.isUserOnline(subcontractorId);
    }
}
