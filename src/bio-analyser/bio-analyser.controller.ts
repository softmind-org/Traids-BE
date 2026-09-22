import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BioAnalyserService } from './bio-analyser.service';
import { BioSearchDto } from './dto/bio-search.dto';

/** Bio Analyser — company users only (AdminGuard means company). */
@Controller('bio-analyser')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BioAnalyserController {
  constructor(private readonly bioAnalyserService: BioAnalyserService) { }

  /**
   * POST /bio-analyser/search
   * Describe the job in plain words to get the top matching subcontractors.
   * Omit conversationId to start a new search; send it to refine one.
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: BioSearchDto, @Request() req) {
    const result = await this.bioAnalyserService.search(
      req.user.sub,
      dto.message,
      dto.conversationId,
    );

    return { message: 'Search completed', data: result };
  }

  /**
   * GET /bio-analyser/conversations
   * Past searches, newest first.
   */
  @Get('conversations')
  async listSearches(@Request() req) {
    const searches = await this.bioAnalyserService.listSearches(req.user.sub);

    return {
      message: 'Searches retrieved successfully',
      count: searches.length,
      data: searches,
    };
  }

  /**
   * GET /bio-analyser/conversations/:id
   * One past search, with its messages and most recent results.
   */
  @Get('conversations/:id')
  async getSearch(@Param('id') id: string, @Request() req) {
    const search = await this.bioAnalyserService.getSearch(id, req.user.sub);

    return { message: 'Search retrieved successfully', data: search };
  }
}
