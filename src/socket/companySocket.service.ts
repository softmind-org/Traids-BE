import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { NotificationService } from '../notification/notification.service';
import { PushService } from '../push/push.service';

@Injectable()
export class CompanySocketService {
    private readonly logger = new Logger(CompanySocketService.name);

    constructor(
        private socketGateway: SocketGateway,
        private notificationService: NotificationService,
        private pushService: PushService,
    ) { }

    /**
     * Notify company about new job application
     */
    async notifyNewJobApplication(
        companyId: string,
        applicationData: {
            applicationId: string;
            jobId: string;
            subcontractorName: string;
            subcontractorId: string;
            appliedAt: Date;
        },
    ): Promise<void> {
        // Emit socket event
        this.socketGateway.getServer()
            .to(`user:${companyId}`)
            .emit('newJobApplication', {
                applicationId: applicationData.applicationId,
                jobId: applicationData.jobId,
                subcontractorName: applicationData.subcontractorName,
                appliedAt: applicationData.appliedAt,
            });

        // Create notification in database
        await this.notificationService.createNotification({
            type: 'newJobApplication',
            title: 'New Job Application',
            message: `${applicationData.subcontractorName} applied for your job`,
            senderId: applicationData.subcontractorId,
            senderType: 'subcontractor',
            senderName: applicationData.subcontractorName,
            receiverId: companyId,
            receiverType: 'company',
            relatedEntityId: applicationData.applicationId,
            relatedEntityType: 'application',
            data: {
                jobId: applicationData.jobId,
                appliedAt: applicationData.appliedAt,
            },
        });

        // Mobile push
        await this.pushService.sendToUser(companyId, 'company', {
            type: 'newJobApplication',
            title: 'New Job Application',
            body: `${applicationData.subcontractorName} applied for your job`,
            data: {
                applicationId: applicationData.applicationId,
                jobId: applicationData.jobId,
                subcontractorId: applicationData.subcontractorId,
            },
        });

        this.logger.log(`New job application notification sent to company ${companyId}`);
    }

    /**
     * Notify company that offer was accepted
     */
    async notifyOfferAccepted(
        companyId: string,
        offerData: {
            offerId: string;
            jobTitle: string;
            subcontractorName: string;
            subcontractorId: string;
        },
    ): Promise<void> {
        // Emit socket event
        this.socketGateway.getServer()
            .to(`user:${companyId}`)
            .emit('offerAccepted', {
                offerId: offerData.offerId,
                jobTitle: offerData.jobTitle,
                subcontractorName: offerData.subcontractorName,
            });

        // Create notification in database
        await this.notificationService.createNotification({
            type: 'offerAccepted',
            title: 'Offer Accepted',
            message: `${offerData.subcontractorName} accepted your offer for ${offerData.jobTitle}`,
            senderId: offerData.subcontractorId,
            senderType: 'subcontractor',
            senderName: offerData.subcontractorName,
            receiverId: companyId,
            receiverType: 'company',
            relatedEntityId: offerData.offerId,
            relatedEntityType: 'offer',
            data: { jobTitle: offerData.jobTitle },
        });

        // Mobile push
        await this.pushService.sendToUser(companyId, 'company', {
            type: 'offerAccepted',
            title: 'Offer Accepted',
            body: `${offerData.subcontractorName} accepted your offer for ${offerData.jobTitle}`,
            data: {
                offerId: offerData.offerId,
                subcontractorId: offerData.subcontractorId,
            },
        });

        this.logger.log(`Offer accepted notification sent to company ${companyId}`);
    }

    /**
     * Notify company that offer was rejected
     */
    async notifyOfferRejected(
        companyId: string,
        offerData: {
            offerId: string;
            jobTitle: string;
            subcontractorName: string;
            subcontractorId: string;
        },
    ): Promise<void> {
        // Emit socket event
        this.socketGateway.getServer()
            .to(`user:${companyId}`)
            .emit('offerRejected', {
                offerId: offerData.offerId,
                jobTitle: offerData.jobTitle,
                subcontractorName: offerData.subcontractorName,
            });

        // Create notification in database
        await this.notificationService.createNotification({
            type: 'offerRejected',
            title: 'Offer Rejected',
            message: `${offerData.subcontractorName} rejected your offer for ${offerData.jobTitle}`,
            senderId: offerData.subcontractorId,
            senderType: 'subcontractor',
            senderName: offerData.subcontractorName,
            receiverId: companyId,
            receiverType: 'company',
            relatedEntityId: offerData.offerId,
            relatedEntityType: 'offer',
            data: { jobTitle: offerData.jobTitle },
        });

        // Mobile push
        await this.pushService.sendToUser(companyId, 'company', {
            type: 'offerRejected',
            title: 'Offer Rejected',
            body: `${offerData.subcontractorName} rejected your offer for ${offerData.jobTitle}`,
            data: {
                offerId: offerData.offerId,
                subcontractorId: offerData.subcontractorId,
            },
        });

        this.logger.log(`Offer rejected notification sent to company ${companyId}`);
    }

    /**
     * Notify company about new message
     */
    async notifyNewMessage(
        companyId: string,
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
            .to(`user:${companyId}`)
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
            senderType: 'subcontractor',
            senderName: messageData.senderName,
            receiverId: companyId,
            receiverType: 'company',
            relatedEntityId: messageData.messageId,
            relatedEntityType: 'message',
            data: { conversationId: messageData.conversationId },
        });

        // Mobile push
        await this.pushService.sendToUser(companyId, 'company', {
            type: 'newMessage',
            title: messageData.senderName,
            body: messageData.preview,
            data: {
                conversationId: messageData.conversationId,
                senderId: messageData.senderId,
                messageId: messageData.messageId,
            },
        });

        this.logger.log(`New message notification sent to company ${companyId}`);
    }

    /**
     * Notify company about job status update
     */
    async notifyJobStatusUpdate(
        companyId: string,
        jobData: {
            jobId: string;
            jobTitle: string;
            status: string;
        },
    ): Promise<void> {
        this.socketGateway.getServer()
            .to(`user:${companyId}`)
            .emit('jobStatusUpdate', {
                jobId: jobData.jobId,
                jobTitle: jobData.jobTitle,
                status: jobData.status,
            });

        // Mobile push
        await this.pushService.sendToUser(companyId, 'company', {
            type: 'jobStatusUpdate',
            title: 'Job Status Updated',
            body: `${jobData.jobTitle} is now ${jobData.status}`,
            data: { jobId: jobData.jobId, status: jobData.status },
        });

        this.logger.log(`Job status update notification sent to company ${companyId}`);
    }

    /**
     * Check if company is currently online
     */
    isCompanyOnline(companyId: string): boolean {
        return this.socketGateway.isUserOnline(companyId);
    }
}
