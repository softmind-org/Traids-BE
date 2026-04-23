import {
  Controller,
  Get,
  Query,
  Request,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import express from 'express';
import { HmrcService } from './hmrc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('hmrc')
export class HmrcController {
  constructor(private readonly hmrcService: HmrcService) { }

  // ─── CONNECT ─────────────────────────────────────────────────────

  @Get('connect/company')
  @UseGuards(JwtAuthGuard, AdminGuard)
  connectCompany(@Request() req) {
    const url = this.hmrcService.getAuthorizationUrl(req.user.sub);
    return { url };
  }

  // ─── CALLBACK ────────────────────────────────────────────────────

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: express.Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (error) {
      return res.redirect(`${frontendUrl}/hmrc/connect?success=false&error=${error}`);
    }

    try {
      await this.hmrcService.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/hmrc/connect?success=true`);
    } catch {
      return res.redirect(`${frontendUrl}/hmrc/connect?success=false&error=callback_failed`);
    }
  }

  // ─── STATUS ──────────────────────────────────────────────────────

  @Get('status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getStatus(@Request() req) {
    return this.hmrcService.getCompanyConnectionStatus(req.user.sub);
  }

  // ─── DISCONNECT ──────────────────────────────────────────────────

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Request() req) {
    await this.hmrcService.disconnectCompany(req.user.sub);
    return { message: 'HMRC account disconnected' };
  }
}
