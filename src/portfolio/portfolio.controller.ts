import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubcontractorGuard } from '../auth/guards/subcontractor.guard';
import { PortfolioService, MAX_PORTFOLIO_PHOTOS } from './portfolio.service';
import { PortfolioItemDto } from './dto/portfolio-item.dto';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Multer options for portfolio photos: JPG / PNG / WEBP, 5 MB each, at most
 * MAX_PORTFOLIO_PHOTOS per request. Oversized files are rejected by multer
 * with 413; wrong types and too many files with 400.
 */
const photoUploadOptions = {
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PORTFOLIO_PHOTOS },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          `Unsupported file type for "${file.originalname}". Photos must be JPG, PNG or WEBP.`,
        ),
        false,
      );
    }
    callback(null, true);
  },
};

@Controller('subcontractor')
@UseGuards(JwtAuthGuard, SubcontractorGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) { }

  /**
   * GET /subcontractor/profile-overview
   * Profile card, certificates, own portfolio (drafts included) and reviews.
   */
  @Get('profile-overview')
  async getProfileOverview(@Request() req) {
    const overview = await this.portfolioService.getProfileOverview(req.user.sub);

    return {
      message: 'Profile overview retrieved successfully',
      data: overview,
    };
  }

  /**
   * POST /subcontractor/portfolio
   * Upload New Work. status "draft" (default) for Save as Draft, "published"
   * for Publish. Photos as multipart files under `photos`.
   */
  @Post('portfolio')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('photos', MAX_PORTFOLIO_PHOTOS, photoUploadOptions))
  async createItem(
    @Body() dto: PortfolioItemDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const item = await this.portfolioService.createItem(dto, req.user.sub, files);

    return {
      message:
        item.status === 'published'
          ? 'Portfolio item published successfully'
          : 'Portfolio item saved as draft',
      data: item,
    };
  }

  /**
   * GET /subcontractor/portfolio
   * Own portfolio, drafts included, newest first.
   */
  @Get('portfolio')
  async getOwnItems(@Request() req) {
    const items = await this.portfolioService.getOwnItems(req.user.sub);

    return {
      message: 'Portfolio retrieved successfully',
      count: items.length,
      data: items,
    };
  }

  /**
   * GET /subcontractor/portfolio/:id
   */
  @Get('portfolio/:id')
  async getOwnItem(@Param('id') id: string, @Request() req) {
    const item = await this.portfolioService.getOwnItem(id, req.user.sub);

    return {
      message: 'Portfolio item retrieved successfully',
      data: item,
    };
  }

  /**
   * PATCH /subcontractor/portfolio/:id
   * Edit an item. Omitted fields are unchanged. Use keepPhotos to control which
   * existing photos remain; new files under `photos` are appended.
   */
  @Patch('portfolio/:id')
  @UseInterceptors(FilesInterceptor('photos', MAX_PORTFOLIO_PHOTOS, photoUploadOptions))
  async updateItem(
    @Param('id') id: string,
    @Body() dto: PortfolioItemDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const item = await this.portfolioService.updateItem(id, dto, req.user.sub, files);

    return {
      message: 'Portfolio item updated successfully',
      data: item,
    };
  }

  /**
   * DELETE /subcontractor/portfolio/:id
   */
  @Delete('portfolio/:id')
  async deleteItem(@Param('id') id: string, @Request() req) {
    await this.portfolioService.deleteItem(id, req.user.sub);

    return {
      message: 'Portfolio item deleted successfully',
    };
  }
}
