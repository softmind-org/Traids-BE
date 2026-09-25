import {
    Body,
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Query,
    UseGuards,
    Request,
    HttpStatus,
    HttpCode,
    HttpException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService, PushUserType } from '../push/push.service';
import { DeviceTokenDto } from '../push/dto/device-token.dto';

/**
 * JwtAuthGuard also admits platform admins, who have no mobile app and live in
 * their own collection — they have no device tokens to register.
 */
function pushUserType(req): PushUserType {
    if (req.user.userType !== 'company' && req.user.userType !== 'subcontractor') {
        throw new HttpException(
            'Device tokens are only supported for company and subcontractor accounts',
            HttpStatus.FORBIDDEN,
        );
    }
    return req.user.userType;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly pushService: PushService,
    ) { }

    /**
     * FCM rotates tokens outside the login flow (reinstall, restore, cache
     * clear). The app calls this from its onTokenRefresh handler so pushes
     * keep landing between logins.
     */
    @Post('device-token')
    @HttpCode(HttpStatus.OK)
    async registerDeviceToken(@Body() dto: DeviceTokenDto, @Request() req) {
        await this.pushService.registerToken(req.user.sub, pushUserType(req), dto.fcmToken);

        return { message: 'Device token registered' };
    }

    /** Call on logout so the device stops receiving this account's pushes. */
    @Delete('device-token')
    @HttpCode(HttpStatus.OK)
    async removeDeviceToken(@Body() dto: DeviceTokenDto, @Request() req) {
        await this.pushService.removeToken(req.user.sub, pushUserType(req), dto.fcmToken);

        return { message: 'Device token removed' };
    }

    @Get()
    async getAllNotifications(
        @Request() req,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
    ) {
        const userId = req.user.sub;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        const result = await this.notificationService.getNotificationsByUser(
            userId,
            pageNum,
            limitNum,
        );

        return {
            message: 'Notifications retrieved successfully',
            ...result,
        };
    }

    @Get('unread')
    async getUnreadNotifications(@Request() req) {
        const userId = req.user.sub;
        const notifications = await this.notificationService.getUnreadNotifications(userId);

        return {
            message: 'Unread notifications retrieved successfully',
            count: notifications.length,
            data: notifications,
        };
    }

    @Get('count')
    async getUnreadCount(@Request() req) {
        const userId = req.user.sub;
        const count = await this.notificationService.getUnreadCount(userId);

        return {
            unreadCount: count,
        };
    }

    @Put(':id/read')
    @HttpCode(HttpStatus.OK)
    async markAsRead(@Param('id') id: string, @Request() req) {
        const userId = req.user.sub;
        const notification = await this.notificationService.markAsRead(id, userId);

        return {
            message: 'Notification marked as read',
            data: notification,
        };
    }

    @Put('read-all')
    @HttpCode(HttpStatus.OK)
    async markAllAsRead(@Request() req) {
        const userId = req.user.sub;
        const result = await this.notificationService.markAllAsRead(userId);

        return {
            message: 'All notifications marked as read',
            modifiedCount: result.modifiedCount,
        };
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteNotification(@Param('id') id: string, @Request() req) {
        const userId = req.user.sub;
        await this.notificationService.deleteNotification(id, userId);

        return {
            message: 'Notification deleted successfully',
        };
    }
}
