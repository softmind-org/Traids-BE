import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CompanySubcontractorService } from './company-subcontractor.service';
import { FilterSubcontractorsDto } from './dto/filter-subcontractors.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PortfolioService } from '../portfolio/portfolio.service';
import { RatingService } from '../rating/rating.service';

@Controller('company/subcontractors')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CompanySubcontractorController {
  constructor(
    private readonly companySubcontractorService: CompanySubcontractorService,
    private readonly portfolioService: PortfolioService,
    private readonly ratingService: RatingService,
  ) {}

  @Get()
  async getAllSubcontractors(@Query() filterDto: FilterSubcontractorsDto) {
    const subcontractors =
      await this.companySubcontractorService.getAllSubcontractorsWithFilters(
        filterDto,
      );

    return {
      message: 'Subcontractors retrieved successfully',
      count: subcontractors.length,
      data: subcontractors,
    };
  }

  @Get(':id')
  async getSubcontractorById(@Param('id') id: string) {
    const subcontractor =
      await this.companySubcontractorService.getSubcontractorById(id);

    if (!subcontractor) {
      throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
    }

    // Published portfolio items only (drafts stay private) plus reviews,
    // returned alongside `data` so the existing profile shape is unchanged.
    const [portfolio, reviews] = await Promise.all([
      this.portfolioService.getPublishedItems(id),
      this.ratingService.getSubcontractorRatings(id),
    ]);

    return {
      message: 'Subcontractor retrieved successfully',
      data: subcontractor,
      portfolio,
      reviews,
    };
  }
}
