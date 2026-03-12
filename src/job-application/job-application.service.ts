import { Injectable, HttpException, HttpStatus, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobApplication, JobApplicationDocument, ApplicationStatus } from './schema/job-application.schema';
import { Job, JobDocument } from '../job/schema/job.schema';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/schema/subcontractor.schema';
import { CreateJobApplicationDto } from './dto/create-job-application.dto';
import { S3UploadService } from '../common/service/s3-upload.service';
import { CompanySocketService } from '../socket/companySocket.service';
import { SubcontractorSocketService } from '../socket/subcontractorSocket.service';

@Injectable()
export class JobApplicationService {
    constructor(
        @InjectModel(JobApplication.name) private applicationModel: Model<JobApplicationDocument>,
        @InjectModel(Job.name) private jobModel: Model<JobDocument>,
        @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
        private s3UploadService: S3UploadService,
        private companySocketService: CompanySocketService,
        private subcontractorSocketService: SubcontractorSocketService,
    ) { }



    async applyForJob(
        createApplicationDto: CreateJobApplicationDto,
        subcontractorId: string,
        files?: Express.Multer.File[],
    ): Promise<JobApplication> {
        // 1. Fetch the job
        const job = await this.jobModel.findById(createApplicationDto.jobId);
        if (!job) {
            throw new NotFoundException('Job not found');
        }

        // 2. Validate job is still available (check if job has reached worker capacity)
        if (job.assignedTo && job.assignedTo.length >= job.workersRequired) {
            throw new BadRequestException('This job has already been fully assigned');
        }

        if (job.status !== 'pending') {
            throw new BadRequestException('This job is no longer accepting applications');
        }

        // 3. Check if job start date hasn't passed (today is still allowed)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const jobStartDay = new Date(job.timelineStartDate);
        jobStartDay.setHours(0, 0, 0, 0);
        if (today > jobStartDay) {
            throw new BadRequestException('Job start date has already passed');
        }

        // 4. Check for duplicate application
        const existingApplication = await this.applicationModel.findOne({
            job: createApplicationDto.jobId,
            subcontractor: subcontractorId,
        });

        if (existingApplication) {
            throw new BadRequestException('You have already applied for this job');
        }

        // 5. Fetch subcontractor profile
        const subcontractor = await this.subcontractorModel.findById(subcontractorId);
        if (!subcontractor) {
            throw new NotFoundException('Subcontractor profile not found');
        }

        // 6. Upload application documents to S3 (if provided)
        let documentUrls: string[] = [];
        if (files && files.length > 0) {
            documentUrls = await this.s3UploadService.uploadMultipleFiles(
                files,
                'job-applications/documents',
            );
        }

        // 7. Create application
        const application = new this.applicationModel({
            job: createApplicationDto.jobId,
            subcontractor: subcontractorId,
            company: job.company,
            fullName: createApplicationDto.fullName,
            proposedDailyRate: createApplicationDto.proposedDailyRate,
            message: createApplicationDto.message,
            applicationDocuments: documentUrls.length > 0 ? documentUrls : createApplicationDto.documents || [],
            status: ApplicationStatus.PENDING,
            appliedAt: new Date(),
        });

        const savedApplication = await application.save();

        // 8. Send notification to company (WebSocket)
        this.notifyCompanyOfNewApplication(job.company.toString(), savedApplication);

        return savedApplication;
    }

    async getApplicationsForJob(jobId: string, companyId: string, status?: string): Promise<JobApplication[]> {
        try {
            // 1. Verify the job exists and belongs to the company
            const job = await this.jobModel.findById(jobId);

            if (!job) {
                throw new NotFoundException('Job not found');
            }

            if (job.company.toString() !== companyId) {
                throw new ForbiddenException('You do not have access to this job');
            }

            // 2. Fetch applications for the job
            const query: any = { job: jobId };

            if (status) {
                query.status = status;
            }

            return await this.applicationModel
                .find(query)
                .populate('subcontractor', 'fullName email primaryTrade yearsOfExperience hourlyRate profileImage cityLocation postcode')
                .sort({ appliedAt: -1 })
                .exec();
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to fetch applications',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getAcceptedApplication(jobId: string): Promise<JobApplication | null> {
        return this.applicationModel.findOne({ job: jobId, status: ApplicationStatus.ACCEPTED })
            .populate('subcontractor', 'fullName email primaryTrade profileImage')
            .exec();
    }

    async acceptApplication(
        applicationId: string,
        companyId: string,
        responseMessage?: string,
    ): Promise<{ application: JobApplication; job: Job }> {
        // 1. Find application
        const application = await this.applicationModel.findById(applicationId);

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        // 2. Verify company owns the job
        if (application.company.toString() !== companyId) {
            throw new ForbiddenException('You do not have access to this application');
        }

        // 3. Check if application is still pending
        if (application.status !== ApplicationStatus.PENDING) {
            throw new BadRequestException('This application has already been processed');
        }

        // 4. Update application status
        application.status = ApplicationStatus.ACCEPTED;
        await application.save();

        // 5. Update job (assign to subcontractor)
        const job = await this.jobModel.findById(application.job);
        if (!job) {
            throw new NotFoundException('Job not found');
        }

        // Add subcontractor to assignedTo array if not already present
        if (!job.assignedTo.includes(application.subcontractor)) {
            job.assignedTo.push(application.subcontractor);
        }
        job.status = 'pending' as any;
        await job.save();

        // 6. Auto-reject remaining pending applications ONLY if the job is now fully staffed
        if (job.assignedTo.length >= job.workersRequired) {
            await this.applicationModel.updateMany(
                {
                    job: application.job,
                    _id: { $ne: applicationId },
                    status: ApplicationStatus.PENDING,
                },
                {
                    status: ApplicationStatus.REJECTED,
                },
            );
        }

        // 7. Notify accepted subcontractor
        const populatedJob = await this.jobModel.findById(application.job).populate('company', 'companyName').exec();
        const companyName = (populatedJob?.company as any)?.companyName || 'Company';

        this.subcontractorSocketService.notifyApplicationAccepted(
            application.subcontractor.toString(),
            {
                applicationId: (application as any)._id,
                jobId: application.job as any,
                message: responseMessage,
                companyId: companyId,
                companyName: companyName,
            }
        );

        return { application, job };
    }

    async rejectApplication(
        applicationId: string,
        companyId: string,
        responseMessage?: string,
    ): Promise<JobApplication> {
        // 1. Find application
        const application = await this.applicationModel.findById(applicationId);

        if (!application) {
            throw new NotFoundException('Application not found');
        }

        // 2. Verify company owns the job
        if (application.company.toString() !== companyId) {
            throw new ForbiddenException('You do not have access to this application');
        }

        // 3. Check if application is still pending
        if (application.status !== ApplicationStatus.PENDING) {
            throw new BadRequestException('This application has already been processed');
        }

        // 4. Update application status
        application.status = ApplicationStatus.REJECTED;
        await application.save();

        // 5. Notify subcontractor
        const populatedJob = await this.jobModel.findById(application.job).populate('company', 'companyName').exec();
        const companyName = (populatedJob?.company as any)?.companyName || 'Company';

        this.subcontractorSocketService.notifyApplicationRejected(
            application.subcontractor.toString(),
            {
                applicationId: (application as any)._id,
                jobId: application.job as any,
                message: responseMessage,
                companyId: companyId,
                companyName: companyName,
            }
        );

        return application;
    }

    private async notifyCompanyOfNewApplication(
        companyId: string,
        application: JobApplication,
    ): Promise<void> {
        // Fetch subcontractor details
        const subcontractor = await this.subcontractorModel.findById(application.subcontractor).exec();

        // Use CompanySocketService for company notifications
        this.companySocketService.notifyNewJobApplication(companyId, {
            applicationId: (application as any)._id,
            jobId: application.job as any,
            subcontractorName: application.fullName,
            subcontractorId: application.subcontractor.toString(),
            appliedAt: application.appliedAt,
        });
    }
}
