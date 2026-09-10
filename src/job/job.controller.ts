import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Query,
  UseInterceptors,
  UploadedFiles,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { SaveJobDto } from './dto/save-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { FilterJobsDto } from './dto/filter-jobs.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SubcontractorGuard } from '../auth/guards/subcontractor.guard';
import { JobApplicationService } from '../job-application/job-application.service';
import { JobApplication } from '../job-application/schema/job-application.schema';
import { OfferService } from '../offer/offer.service';
import { Offer } from '../offer/schema/offer.schema';
import { Status } from './schema/job.schema';
import { RatingService } from '../rating/rating.service';

@Controller('jobs')
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly jobApplicationService: JobApplicationService,
    private readonly offerService: OfferService,
    private readonly ratingService: RatingService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('documents', 10))
  async createJob(
    @Body() createJobDto: CreateJobDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const job = await this.jobService.createJob(createJobDto, req.user.sub, files);

    return {
      message: 'Job created successfully',
      data: job,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getMyJobs(@Request() req) {
    const [jobs, savedJobs] = await Promise.all([
      this.jobService.getJobsByCompany(req.user.sub),
      this.jobService.getSavedJobsByCompany(req.user.sub),
    ]);

    // savedJobs feeds the "Saved Jobs" tab. Returned from the same call as the
    // live jobs so My Jobs renders every tab count without a second request.
    return {
      message: 'Jobs retrieved successfully',
      count: jobs.length,
      data: jobs,
      savedJobs,
      savedJobsCount: savedJobs.length,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SAVED JOBS ("Save for Later" templates)
  // Declared before @Get(':id') so "saved" is not matched as a job id.
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /jobs/saved
   * Save the Post New Job form for later. Every field is optional.
   */
  @Post('saved')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('documents', 10))
  async createSavedJob(
    @Body() saveJobDto: SaveJobDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const savedJob = await this.jobService.createSavedJob(
      saveJobDto,
      req.user.sub,
      files,
    );

    return {
      message: 'Job saved successfully',
      data: savedJob,
    };
  }

  /**
   * GET /jobs/saved
   * The Saved Jobs tab.
   */
  @Get('saved')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getSavedJobs(@Request() req) {
    const savedJobs = await this.jobService.getSavedJobsByCompany(req.user.sub);

    return {
      message: 'Saved jobs retrieved successfully',
      count: savedJobs.length,
      data: savedJobs,
    };
  }

  /**
   * GET /jobs/saved/:id
   * One saved job, to re-open the Post New Job form pre-filled.
   */
  @Get('saved/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getSavedJobById(@Param('id') id: string, @Request() req) {
    const savedJob = await this.jobService.getSavedJobById(id, req.user.sub);

    return {
      message: 'Saved job retrieved successfully',
      data: savedJob,
    };
  }

  /**
   * PATCH /jobs/saved/:id
   * Save changes back onto an existing saved job. Omitted fields are left as-is.
   */
  @Patch('saved/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FilesInterceptor('documents', 10))
  async updateSavedJob(
    @Param('id') id: string,
    @Body() saveJobDto: SaveJobDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const savedJob = await this.jobService.updateSavedJob(
      id,
      saveJobDto,
      req.user.sub,
      files,
    );

    return {
      message: 'Saved job updated successfully',
      data: savedJob,
    };
  }

  /**
   * DELETE /jobs/saved/:id
   */
  @Delete('saved/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteSavedJob(@Param('id') id: string, @Request() req) {
    await this.jobService.deleteSavedJob(id, req.user.sub);

    return {
      message: 'Saved job deleted successfully',
    };
  }

  /**
   * POST /jobs/saved/:id/publish
   * Publish a saved job as a live job. The saved job is a reusable template, so
   * it remains in the Saved Jobs tab afterwards. Any fields sent in the body
   * override the stored ones, so the user can tweak the pre-filled form and
   * publish without saving the edit back first.
   */
  @Post('saved/:id/publish')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('documents', 10))
  async publishSavedJob(
    @Param('id') id: string,
    @Body() overrides: SaveJobDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const { job, savedJob } = await this.jobService.publishSavedJob(
      id,
      req.user.sub,
      overrides,
      files,
    );

    return {
      message: 'Job published successfully',
      data: job,
      savedJob,
    };
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  async getAvailableJobs(@Query() filterJobsDto: FilterJobsDto, @Request() req) {
    const filters = {
      trade: filterJobsDto.trade,
      maxHourlyRate: filterJobsDto.maxHourlyRate,
      location: filterJobsDto.location,
      startDate: filterJobsDto.startDate ? new Date(filterJobsDto.startDate) : undefined,
      page: filterJobsDto.page,
    };

    const result = await this.jobService.getAllJobsWithFilters(filters);
    const data = await this.withHasApplied(result.jobs, req.user.sub);

    return {
      message: 'Available jobs retrieved successfully',
      count: result.jobs.length,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      data,
    };
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  async searchAvailableJobs(@Query() searchJobsDto: SearchJobsDto, @Request() req) {
    const result = await this.jobService.searchAvailableJobs(
      searchJobsDto.q,
      searchJobsDto.page,
    );
    const data = await this.withHasApplied(result.jobs, req.user.sub);

    return {
      message: 'Search results retrieved successfully',
      count: result.jobs.length,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      data,
    };
  }

  /**
   * Annotate a page of jobs with whether this subcontractor has already
   * applied, using a single lookup for the whole page.
   */
  private async withHasApplied(jobs: any[], subcontractorId: string) {
    const appliedIds = await this.jobApplicationService.getAppliedJobIds(
      subcontractorId,
      jobs.map((j) => j._id.toString()),
    );

    return jobs.map((job) => ({
      ...(typeof job.toObject === 'function' ? job.toObject() : job),
      hasApplied: appliedIds.has(job._id.toString()),
    }));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getJobById(@Param('id') id: string, @Request() req) {
    const job = await this.jobService.getJobById(id);
    const companyId = job.company['_id'] ? job.company['_id'].toString() : job.company.toString();
    const isOwner = req.user.userType === 'company' && companyId === req.user.sub;

    // Apply-button state for the logged-in subcontractor. Computed once and
    // merged into every response path below so the field is always present for
    // a subcontractor, whatever branch the job falls into. Absent entirely for
    // company/admin callers.
    const isSubcontractor = req.user.userType === 'subcontractor';
    const myApplication = isSubcontractor
      ? await this.jobApplicationService.getMyApplicationForJob(id, req.user.sub)
      : null;
    const applicationState = isSubcontractor
      ? { hasApplied: !!myApplication, myApplication }
      : {};

    // Handle OFFER type jobs
    if (job.typeOfJob === 'offer') {
      let offers: Offer[] = [];
      let acceptedOffer: Offer | null = null;

      if (isOwner) {
        // If job is pending, show all offers sent
        if (job.status === Status.PENDING) {
          offers = await this.offerService.getOffersForJob(id);
          return {
            message: 'Job retrieved successfully',
            data: {
              ...job.toObject(),
              ...applicationState,
              offers,
            },
          };
        }

        // If job is accepted/in_progress/completed, show the accepted offer
        if (job.assignedTo && job.assignedTo.length > 0) {
          acceptedOffer = await this.offerService.getAcceptedOffer(id);
          return {
            message: 'Job retrieved successfully',
            data: {
              ...job.toObject(),
              ...applicationState,
              acceptedOffer,
            },
          };
        }
      }

      // For non-owners viewing offer jobs


      return {
        message: 'Job retrieved successfully',
        data: { ...job.toObject(), ...applicationState },
      };
    }

    // Handle REQUEST type jobs (original logic)
    let applications: JobApplication[] = [];
    let assignedApplication: JobApplication | null = null;

    // If job is not pending and has assignedTo, fetch the accepted application
    if (job.assignedTo && job.assignedTo.length > 0) {
      assignedApplication = await this.jobApplicationService.getAcceptedApplication(id);
    }

    if (isOwner) {
      const [fetchedApplications, offers] = await Promise.all([
        this.jobApplicationService.getApplicationsForJob(id, req.user.sub),
        this.offerService.getOffersForJob(id),
      ]);
      applications = fetchedApplications;

      return {
        message: 'Job retrieved successfully',
        data: {
          ...job.toObject(),
          ...applicationState,
          applications,
          offers,
          assignedApplication,
        },
      };
    }

    // For subcontractors or non-owner companies, just return job details
    if (assignedApplication) {
      return {
        message: 'Job retrieved successfully',
        data: {
          ...job.toObject(),
          ...applicationState,
          assignedApplication,
        },
      };
    }

    return {
      message: 'Job retrieved successfully',
      data: { ...job.toObject(), ...applicationState },
    };
  }

  /**
   * 
   * Start a job manually (change status to IN_PROGRESS)
   * POST /jobs/:id/start
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async startJob(@Param('id') jobId: string, @Request() req) {
    const job = await this.jobService.startJob(jobId, req.user.sub);

    return {
      success: true,
      message: 'Job started successfully',
      data: job,
    };
  }

  //comment aded


  /**
   * Complete a job manually 
   * POST /jobs/:id/complete
   */
  @Post(':id/complete')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async completeJob(@Param('id') jobId: string, @Request() req) {
    const job = await this.jobService.completeJob(jobId, req.user.sub);
    return {
      success: true,
      message: 'Job completed successfully',
      data: job,
    };
  }

  /**
   * Rate a subcontractor on a job
   * POST /jobs/:id/rate/:subcontractorId
   */
  @Post(':id/rate/:subcontractorId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async rateSubcontractor(
    @Param('id') jobId: string,
    @Param('subcontractorId') subcontractorId: string,
    @Body() body: { rating: number; comment?: string },
    @Request() req,
  ) {
    const result = await this.ratingService.rateSubcontractor(
      jobId,
      subcontractorId,
      req.user.sub,
      body.rating,
      body.comment,
    );
    return { success: true, message: 'Rating submitted successfully', data: result };
  }

  /**
   * Get all ratings for a subcontractor
   * GET /jobs/ratings/:subcontractorId
   */
  @Get('ratings/:subcontractorId')
  @UseGuards(JwtAuthGuard)
  async getSubcontractorRatings(@Param('subcontractorId') subcontractorId: string) {
    return this.ratingService.getSubcontractorRatings(subcontractorId);
  }

  /**
   * Get all ratings for a specific job
   * GET /jobs/:id/ratings
   */
  @Get(':id/ratings')
  @UseGuards(JwtAuthGuard)
  async getJobRatings(@Param('id') jobId: string) {
    return this.ratingService.getJobRatings(jobId);
  }

  /**
   * Update a job
   * PATCH /jobs/:id
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('documents', 10))
  async updateJob(
    @Param('id') jobId: string,
    @Body() updateJobDto: UpdateJobDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const job = await this.jobService.updateJob(
      jobId,
      updateJobDto,
      req.user.sub,
      files,
    );

    return {
      success: true,
      message: 'Job updated successfully',
      data: job,
    };
  }

  /**
   * Delete a job and all related records
   * DELETE /jobs/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async deleteJob(@Param('id') jobId: string, @Request() req) {
    await this.jobService.deleteJob(jobId, req.user.sub);

    return {
      success: true,
      message: 'Job and all related records deleted successfully',
    };
  }
}
