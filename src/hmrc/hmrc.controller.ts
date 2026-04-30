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
import { SubcontractorGuard } from '../auth/guards/subcontractor.guard';

@Controller('hmrc')
export class HmrcController {
  constructor(private readonly hmrcService: HmrcService) { }

  // ─── COMPANY: CONNECT ────────────────────────────────────────────

  @Get('connect/company')
  @UseGuards(JwtAuthGuard, AdminGuard)
  connectCompany(@Request() req) {
    const url = this.hmrcService.getAuthorizationUrl(req.user.sub);
    return { url };
  }

  // ─── SUBCONTRACTOR: CONNECT ──────────────────────────────────────

  @Get('connect/subcontractor')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  connectSubcontractor(@Request() req) {
    const url = this.hmrcService.getSubcontractorAuthorizationUrl(req.user.sub);
    return { url };
  }

  // ─── CALLBACK (shared for company and subcontractor) ─────────────

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

  // ─── COMPANY: STATUS ─────────────────────────────────────────────

  @Get('status/company')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getCompanyStatus(@Request() req) {
    return this.hmrcService.getCompanyConnectionStatus(req.user.sub);
  }

  // ─── SUBCONTRACTOR: STATUS ───────────────────────────────────────

  @Get('status/subcontractor')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  getSubcontractorStatus(@Request() req) {
    return this.hmrcService.getSubcontractorConnectionStatus(req.user.sub);
  }

  // ─── COMPANY: DISCONNECT ─────────────────────────────────────────

  @Delete('disconnect/company')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async disconnectCompany(@Request() req) {
    await this.hmrcService.disconnectCompany(req.user.sub);
    return { message: 'HMRC account disconnected' };
  }

  // ─── SUBCONTRACTOR: DISCONNECT ───────────────────────────────────

  @Delete('disconnect/subcontractor')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  @HttpCode(HttpStatus.OK)
  async disconnectSubcontractor(@Request() req) {
    await this.hmrcService.disconnectSubcontractor(req.user.sub);
    return { message: 'HMRC account disconnected' };
  }

  // ─── LEGACY: keep /hmrc/status and /hmrc/disconnect pointing to company ──

  @Get('status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getStatus(@Request() req) {
    return this.hmrcService.getCompanyConnectionStatus(req.user.sub);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Request() req) {
    await this.hmrcService.disconnectCompany(req.user.sub);
    return { message: 'HMRC account disconnected' };
  }
}
