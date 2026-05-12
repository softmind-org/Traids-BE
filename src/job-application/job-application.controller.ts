import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpStatus,
    HttpCode,
    UseInterceptors,
    UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JobApplicationService } from './job-application.service';
import { CreateJobApplicationDto } from './dto/create-job-application.dto';
import { FilterApplicationsDto } from './dto/filter-applications.dto';
import { RespondToApplicationDto } from './dto/respond-to-application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SubcontractorGuard } from '../auth/guards/subcontractor.guard';

@Controller('job-applications')
export class JobApplicationController {
    constructor(private readonly jobApplicationService: JobApplicationService) { }

    // ==================== SUBCONTRACTOR ENDPOINTS ====================

    @Post()
    @UseGuards(JwtAuthGuard, SubcontractorGuard)
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FilesInterceptor('documents', 5)) // Max 5 files
    async applyForJob(
        @Body() createApplicationDto: CreateJobApplicationDto,
        @Request() req,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        const application = await this.jobApplicationService.applyForJob(
            createApplicationDto,
            req.user.sub, // subcontractor ID from JWT
            files,
        );

        return {
            message: 'Application submitted successfully',
            data: application,
        };
    }

    // ==================== COMPANY ENDPOINTS ====================

    @Get('job/:jobId')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async getJobApplications(
        @Param('jobId') jobId: string,
        @Query() filterDto: FilterApplicationsDto,
        @Request() req,
    ) {
        const applications = await this.jobApplicationService
            .getApplicationsForJob(jobId, req.user.sub, filterDto.status);

        return {
            message: 'Applications retrieved successfully',
            count: applications.length,
            data: applications,
        };
    }

    @Patch(':applicationId/accept')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async acceptApplication(
        @Param('applicationId') applicationId: string,
        @Request() req,
        @Body() respondDto: RespondToApplicationDto,
    ) {
        const result = await this.jobApplicationService.acceptApplication(
            applicationId,
            req.user.sub,
            respondDto.responseMessage,
        );

        return {
            message: 'Application accepted successfully',
            data: result,
        };
    }

    @Patch(':applicationId/reject')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async rejectApplication(
        @Param('applicationId') applicationId: string,
        @Request() req,
        @Body() respondDto: RespondToApplicationDto,
    ) {
        const application = await this.jobApplicationService.rejectApplication(
            applicationId,
            req.user.sub,
            respondDto.responseMessage,
        );

        return {
            message: 'Application rejected successfully',
            data: application,
        };
    }
}
