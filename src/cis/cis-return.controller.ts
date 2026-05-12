import {
  Controller,
  Get,
  Post,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
// Post/HttpCode kept for markAsPaid endpoint
import { CisReturnService } from './cis-return.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('cis-returns')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CisReturnController {
  constructor(private readonly cisReturnService: CisReturnService) {}

  /**
   * GET /cis-returns
   * List all CIS returns for the logged-in company.
   */
  @Get()
  getReturns(@Request() req) {
    return this.cisReturnService.getReturns(req.user.sub);
  }

  /**
   * GET /cis-returns/:id
   * Get a single CIS return with full subcontractor breakdown.
   */
  @Get(':id')
  getReturn(@Param('id') id: string, @Request() req) {
    return this.cisReturnService.getReturn(id, req.user.sub);
  }

  // POST /cis-returns/:id/submit — deferred to Phase 2 (HMRC submission)

  /**
   * POST /cis-returns/:id/mark-paid
   * Company confirms they have paid HMRC.
   */
  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  markAsPaid(@Param('id') id: string, @Request() req) {
    return this.cisReturnService.markAsPaid(id, req.user.sub);
  }
}
