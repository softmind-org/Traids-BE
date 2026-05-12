import { Controller } from '@nestjs/common';
import { HmrcService } from './hmrc.service';

// ── PHASE 2 ──────────────────────────────────────────────────────────────────
// All HMRC OAuth endpoints (connect, callback, disconnect, status) for both
// company and subcontractor are deferred to the next phase.
// Uncomment the full controller when HMRC integration is re-enabled.

@Controller('hmrc')
export class HmrcController {
  constructor(private readonly hmrcService: HmrcService) { }

  // @Get('connect/company')
  // @UseGuards(JwtAuthGuard, AdminGuard)
  // connectCompany(@Request() req) {
  //   const url = this.hmrcService.getAuthorizationUrl(req.user.sub);
  //   return { url };
  // }

  // @Get('connect/subcontractor')
  // @UseGuards(JwtAuthGuard, SubcontractorGuard)
  // connectSubcontractor(@Request() req) {
  //   const url = this.hmrcService.getSubcontractorAuthorizationUrl(req.user.sub);
  //   return { url };
  // }

  // @Get('callback')
  // async callback(@Query('code') code, @Query('state') state, @Query('error') error, @Res() res) { ... }

  // @Get('status/company')   @UseGuards(JwtAuthGuard, AdminGuard)
  // @Get('status/subcontractor')  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  // @Delete('disconnect/company') @UseGuards(JwtAuthGuard, AdminGuard)
  // @Delete('disconnect/subcontractor') @UseGuards(JwtAuthGuard, SubcontractorGuard)
}
