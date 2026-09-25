import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeviceTokenDto } from './dto/device-token.dto';
import { PushService, PushUserType } from './push.service';

@Controller('device-token')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) { }

  /**
   * JwtAuthGuard also admits platform admins, who have no mobile app and live
   * in their own collection — they have no device tokens to register.
   */
  private userType(req): PushUserType {
    if (req.user.userType !== 'company' && req.user.userType !== 'subcontractor') {
      throw new HttpException(
        'Device tokens are only supported for company and subcontractor accounts',
        HttpStatus.FORBIDDEN,
      );
    }
    return req.user.userType;
  }

  /**
   * Add or update this account's FCM token.
   *
   * The app calls this right after every login and signup, and again whenever
   * FCM rotates the token (reinstall, restore, cache clear). Sending a token
   * the account already has is a no-op, so it is safe to call every time.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async addOrUpdate(@Body() dto: DeviceTokenDto, @Request() req) {
    await this.pushService.registerToken(req.user.sub, this.userType(req), dto.fcmToken);

    return { message: 'FCM token saved' };
  }

  /** Call on logout so this device stops receiving the account's notifications. */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async remove(@Body() dto: DeviceTokenDto, @Request() req) {
    await this.pushService.removeToken(req.user.sub, this.userType(req), dto.fcmToken);

    return { message: 'FCM token removed' };
  }
}
