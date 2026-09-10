import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, Status } from './schema/job.schema';
import { SavedJob, SavedJobDocument } from './schema/saved-job.schema';
import { SaveJobDto } from './dto/save-job.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { S3UploadService } from '../common/service/s3-upload.service';
import { ComplianceService } from '../compliance/compliance.service';
import { Offer, OfferDocument } from '../offer/schema/offer.schema';
import { JobApplication, JobApplicationDocument } from '../job-application/schema/job-application.schema';
import { Compliance, ComplianceDocument } from '../compliance/schema/compliance.schema';
import { workerData } from 'worker_threads';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @InjectModel(JobApplication.name) private applicationModel: Model<JobApplicationDocument>,
    @InjectModel(Compliance.name) private complianceModel: Model<ComplianceDocument>,
    @InjectModel(SavedJob.name) private savedJobModel: Model<SavedJobDocument>,
    private s3UploadService: S3UploadService,
    private complianceService: ComplianceService,
  ) { }

  async createJob(
    createJobDto: CreateJobDto,
    userId: string,
    files?: Express.Multer.File[],
  ): Promise<JobDocument> {
    try {
      let documentUrls: string[] = [];

      // Upload documents to S3 if provided
      if (files && files.length > 0) {
        documentUrls = await this.s3UploadService.uploadMultipleFiles(
          files,
          'jobs/documents',
        );
      }

      const job = new this.jobModel({
        company: new Types.ObjectId(userId),
        jobTitle: createJobDto.jobTitle,
        trade: createJobDto.trade,
        description: createJobDto.description,
        siteAddress: createJobDto.siteAddress,
        timelineStartDate: new Date(createJobDto.timelineStartDate),
        timelineEndDate: new Date(createJobDto.timelineEndDate),
        hourlyRate: createJobDto.hourlyRate,
        typeOfJob: 'request',
        projectDocuments: documentUrls.length > 0 ? documentUrls : createJobDto.documents || [],
        workersRequired: createJobDto.workersRequired,
      });

      const savedJob = await job.save();

      // Automatically create a compliance record for this job
      await this.complianceService.createCompliance(
        createJobDto.jobTitle,
        savedJob._id.toString(),
      );

      return savedJob;
    } catch (error) {
      throw new HttpException(
        'Failed to create job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SAVED JOBS (job templates — the "Save for Later" action)
  // ─────────────────────────────────────────────────────────────

  /**
   * Upload any attached files once and return the URLs to store on a template.
   */
  private async resolveTemplateDocuments(
    dto: SaveJobDto,
    files?: Express.Multer.File[],
  ): Promise<string[] | undefined> {
    if (files && files.length > 0) {
      return this.s3UploadService.uploadMultipleFiles(files, 'jobs/documents');
    }
    return dto.documents;
  }

  /**
   * Map the DTO onto template fields, skipping anything the client omitted so a
   * partial update never blanks a field that was already filled in.
   */
  private buildTemplatePatch(dto: SaveJobDto, documentUrls?: string[]): Record<string, any> {
    const patch: Record<string, any> = {};

    if (dto.jobTitle !== undefined) patch.jobTitle = dto.jobTitle;
    if (dto.trade !== undefined) patch.trade = dto.trade;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.siteAddress !== undefined) patch.siteAddress = dto.siteAddress;
    if (dto.timelineStartDate !== undefined) {
      patch.timelineStartDate = new Date(dto.timelineStartDate);
    }
    if (dto.timelineEndDate !== undefined) {
      patch.timelineEndDate = new Date(dto.timelineEndDate);
    }
    if (dto.hourlyRate !== undefined) patch.hourlyRate = dto.hourlyRate;
    if (dto.workersRequired !== undefined) patch.workersRequired = dto.workersRequired;
    if (documentUrls !== undefined) patch.projectDocuments = documentUrls;

    return patch;
  }

  async createSavedJob(
    dto: SaveJobDto,
    companyId: string,
    files?: Express.Multer.File[],
  ): Promise<SavedJobDocument> {
    const documentUrls = await this.resolveTemplateDocuments(dto, files);

    const savedJob = new this.savedJobModel({
      company: new Types.ObjectId(companyId),
      ...this.buildTemplatePatch(dto, documentUrls ?? []),
    });

    return savedJob.save();
  }

  async getSavedJobsByCompany(companyId: string): Promise<SavedJobDocument[]> {
    return this.savedJobModel
      .find({ company: new Types.ObjectId(companyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * One template, for re-opening the Post New Job form pre-filled.
   */
  async getSavedJobById(
    savedJobId: string,
    companyId: string,
  ): Promise<SavedJobDocument> {
    const savedJob = await this.savedJobModel.findById(savedJobId);

    if (!savedJob) {
      throw new HttpException('Saved job not found', HttpStatus.NOT_FOUND);
    }
    if (savedJob.company.toString() !== companyId) {
      throw new HttpException(
        'You do not have permission to view this saved job',
        HttpStatus.FORBIDDEN,
      );
    }

    return savedJob;
  }

  async updateSavedJob(
    savedJobId: string,
    dto: SaveJobDto,
    companyId: string,
    files?: Express.Multer.File[],
  ): Promise<SavedJobDocument> {
    // Ownership check before touching anything.
    await this.getSavedJobById(savedJobId, companyId);

    const documentUrls = await this.resolveTemplateDocuments(dto, files);
    const patch = this.buildTemplatePatch(dto, documentUrls);

    const updated = await this.savedJobModel
      .findByIdAndUpdate(savedJobId, { $set: patch }, { new: true })
      .exec();

    if (!updated) {
      throw new HttpException('Saved job not found', HttpStatus.NOT_FOUND);
    }

    return updated;
  }

  async deleteSavedJob(savedJobId: string, companyId: string): Promise<void> {
    await this.getSavedJobById(savedJobId, companyId);
    await this.savedJobModel.findByIdAndDelete(savedJobId).exec();
  }

  /**
   * Publish a template as a real job.
   *
   * The template is a reusable blueprint, so it SURVIVES publishing — only its
   * usage counters are bumped. Fields the client sends override the stored ones,
   * which is what lets the user open the pre-filled form, tweak it, and publish
   * without first saving the edit back to the template.
   */
  async publishSavedJob(
    savedJobId: string,
    companyId: string,
    overrides?: SaveJobDto,
    files?: Express.Multer.File[],
  ): Promise<{ job: JobDocument; savedJob: SavedJobDocument }> {
    const savedJob = await this.getSavedJobById(savedJobId, companyId);

    const documentUrls = await this.resolveTemplateDocuments(overrides ?? {}, files);

    // Stored template values, with any client overrides applied on top.
    const merged = {
      jobTitle: overrides?.jobTitle ?? savedJob.jobTitle,
      trade: overrides?.trade ?? savedJob.trade,
      description: overrides?.description ?? savedJob.description,
      siteAddress: overrides?.siteAddress ?? savedJob.siteAddress,
      timelineStartDate: overrides?.timelineStartDate
        ? new Date(overrides.timelineStartDate)
        : savedJob.timelineStartDate,
      timelineEndDate: overrides?.timelineEndDate
        ? new Date(overrides.timelineEndDate)
        : savedJob.timelineEndDate,
      hourlyRate: overrides?.hourlyRate ?? savedJob.hourlyRate,
      workersRequired: overrides?.workersRequired ?? savedJob.workersRequired ?? 1,
      // Documents uploaded on the template carry over so the user does not
      // re-attach them at publish time.
      projectDocuments: documentUrls ?? savedJob.projectDocuments ?? [],
    };

    // Job requires all of these; a template is allowed to be incomplete, so the
    // check belongs here rather than in the DTO. Report every gap at once so the
    // form can highlight all missing fields in one pass.
    const missing = [
      'jobTitle',
      'trade',
      'description',
      'siteAddress',
      'timelineStartDate',
      'timelineEndDate',
      'hourlyRate',
    ].filter((field) => {
      const value = (merged as Record<string, any>)[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      throw new HttpException(
        {
          message: `This saved job is missing required fields: ${missing.join(', ')}`,
          missingFields: missing,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const job = new this.jobModel({
      company: new Types.ObjectId(companyId),
      typeOfJob: 'request',
      ...merged,
    });

    const publishedJob = await job.save();

    // Mirrors createJob: every published job gets a compliance record.
    await this.complianceService.createCompliance(
      merged.jobTitle as string,
      publishedJob._id.toString(),
    );

    savedJob.lastPublishedAt = new Date();
    savedJob.timesPublished = (savedJob.timesPublished ?? 0) + 1;
    await savedJob.save();

    this.logger.log(
      `Published job ${publishedJob._id} from saved job ${savedJobId} (company ${companyId})`,
    );

    return { job: publishedJob, savedJob };
  }

  async getJobsByCompany(companyId: string): Promise<JobDocument[]> {
    try {
      return await this.jobModel
        .find({ company: new Types.ObjectId(companyId) })
        .populate('company', 'companyName workEmail')
        .populate('assignedTo', 'fullName email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new HttpException(
        'Failed to fetch jobs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getJobsBySubcontractor(subcontractorId: string): Promise<JobDocument[]> {
    try {
      return await this.jobModel
        .find({ assignedTo: new Types.ObjectId(subcontractorId) })
        .populate('company', 'companyName workEmail phoneNumber headOfficeAddress profileImage')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new HttpException(
        'Failed to fetch assigned jobs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllJobsWithFilters(filters: {
    trade?: string[];
    maxHourlyRate?: number;
    location?: string;
    startDate?: Date;
    page?: number;
  }): Promise<{ jobs: JobDocument[]; total: number; page: number; totalPages: number }> {
    try {
      const query: any = {};
      const page = filters.page || 1;
      const limit = 20;
      const skip = (page - 1) * limit;

      // Only show jobs that haven't reached their worker capacity
      // assignedTo.length < workersRequired
      query.$expr = { $lt: [{ $size: { $ifNull: ['$assignedTo', []] } }, '$workersRequired'] };
      query.status = 'pending'; // Only show jobs that are still pending (not accepted or completed)

      // Exclude offer-type jobs (subcontractors can only apply to request-type jobs)
      query.typeOfJob = { $ne: 'offer' };

      // Filter by trade type (supports multiple values)
      if (filters.trade?.length) {
        query.trade = filters.trade.length === 1 ? filters.trade[0] : { $in: filters.trade };
      }

      if (filters.maxHourlyRate) {
        query.hourlyRate = { $lte: filters.maxHourlyRate };
      }

      // Filter by location (case-insensitive partial match)
      if (filters.location) {
        query.siteAddress = { $regex: filters.location, $options: 'i' };
      }

      // Filter by start date - find jobs that start on or after the given date
      if (filters.startDate) {
        query.timelineStartDate = { $gte: filters.startDate };
      }


      const total = await this.jobModel.countDocuments(query);

      const jobs = await this.jobModel
        .find(query)
        .populate('company', 'companyName workEmail phoneNumber headOfficeAddress profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      return {
        jobs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch jobs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async searchAvailableJobs(
    q: string,
    page = 1,
  ): Promise<{ jobs: JobDocument[]; total: number; page: number; totalPages: number }> {
    const limit = 20;
    const skip = (page - 1) * limit;
    const regex = { $regex: q, $options: 'i' };

    const query: any = {
      status: 'pending',
      typeOfJob: { $ne: 'offer' },
      $expr: { $lt: [{ $size: { $ifNull: ['$assignedTo', []] } }, '$workersRequired'] },
      $or: [
        { jobTitle: regex },
        { description: regex },
        { siteAddress: regex },
        { trade: regex },
      ],
    };

    const [total, jobs] = await Promise.all([
      this.jobModel.countDocuments(query),
      this.jobModel
        .find(query)
        .populate('company', 'companyName workEmail phoneNumber headOfficeAddress profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    return { jobs, total, page, totalPages: Math.ceil(total / limit) };
  }
  async getJobById(jobId: string): Promise<JobDocument> {
    try {
      const job = await this.jobModel.findById(jobId)
        .populate('company', 'companyName workEmail phoneNumber headOfficeAddress profileImage')
        .populate('assignedTo', 'fullName email primaryTrade hourlyRate yearsOfExperience cityLocation averageRating profileImage professionalBio')
        .exec();

      if (!job) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }
      return job;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually start a job (change status to IN_PROGRESS)
   * Updates the timelineStartDate to current date/time
   */
  async startJob(jobId: string, companyId: string): Promise<JobDocument> {
    try {
      const job = await this.jobModel.findById(jobId);

      if (!job) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      // Verify the job belongs to the company
      if (job.company.toString() !== companyId) {
        throw new HttpException('Unauthorized to start this job', HttpStatus.FORBIDDEN);
      }

      // Check if job is in PENDING status
      if (job.status !== 'pending') {
        throw new HttpException(
          `Job cannot be started. Current status: ${job.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Update job status and start date
      const updatedJob = await this.jobModel.findByIdAndUpdate(
        jobId,
        {
          status: 'in_progress',
          timelineStartDate: new Date(),
        },
        { new: true },
      )
        .populate('company', 'companyName workEmail phoneNumber')
        .populate('assignedTo', 'fullName email primaryTrade')
        .exec();

      if (!updatedJob) {
        throw new HttpException('Failed to update job', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      this.logger.log(`Job started: ${updatedJob.jobTitle} (ID: ${jobId})`);

      // TODO: Send notifications to assigned workers
      // this.notificationService.notifyJobStarted(updatedJob);

      return updatedJob;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to start job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually complete a job (change status to COMPLETED)
   * Only the company that owns the job can complete it.
   * Job must be in IN_PROGRESS or ACCEPTED status.
   */
  async completeJob(jobId: string, companyId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId);

    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }

    if (job.company.toString() !== companyId) {
      throw new HttpException('Unauthorized to complete this job', HttpStatus.FORBIDDEN);
    }

    if (job.status !== 'in_progress' && job.status !== 'accepted') {
      throw new HttpException(
        `Job cannot be completed. Current status: ${job.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(jobId, { status: 'completed' }, { new: true })
      .populate('company', 'companyName workEmail phoneNumber')
      .populate('assignedTo', 'fullName email primaryTrade')
      .exec();

    if (!updatedJob) {
      throw new HttpException('Failed to complete job', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.logger.log(`Job manually completed: ${job.jobTitle} (${jobId}) by company ${companyId}`);

    return updatedJob;
  }

  /**
   * Update a job
   * Only the company that created the job can update it
   * Cannot update jobs that are in_progress or completed
   */
  async updateJob(
    jobId: string,
    updateJobDto: UpdateJobDto,
    companyId: string,
    files?: Express.Multer.File[],
  ): Promise<JobDocument> {
    try {
      // Find the job and verify it exists
      const job = await this.jobModel.findById(jobId);

      if (!job) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      // Verify the company owns this job
      if (job.company.toString() !== companyId) {
        throw new HttpException(
          'You do not have permission to update this job',
          HttpStatus.FORBIDDEN,
        );
      }

      // Prevent updating if job is in progress or completed
      if (job.status === 'in_progress' || job.status === 'completed') {
        throw new HttpException(
          `Cannot update job with status: ${job.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Handle file uploads if provided
      let documentUrls: string[] = [];
      if (files && files.length > 0) {
        documentUrls = await this.s3UploadService.uploadMultipleFiles(
          files,
          'jobs/documents',
        );
      }

      // Prepare update object
      const updateData: any = {};

      if (updateJobDto.jobTitle) updateData.jobTitle = updateJobDto.jobTitle;
      if (updateJobDto.trade) updateData.trade = updateJobDto.trade;
      if (updateJobDto.description) updateData.description = updateJobDto.description;
      if (updateJobDto.siteAddress) updateData.siteAddress = updateJobDto.siteAddress;
      if (updateJobDto.timelineStartDate) {
        updateData.timelineStartDate = new Date(updateJobDto.timelineStartDate);
      }
      if (updateJobDto.timelineEndDate) {
        updateData.timelineEndDate = new Date(updateJobDto.timelineEndDate);
      }
      if (updateJobDto.hourlyRate !== undefined) updateData.hourlyRate = updateJobDto.hourlyRate;
      if (updateJobDto.workersRequired !== undefined) {
        updateData.workersRequired = updateJobDto.workersRequired;
      }

      // Handle documents
      if (documentUrls.length > 0) {
        // Append new documents to existing ones
        updateData.projectDocuments = [...job.projectDocuments, ...documentUrls];
      } else if (updateJobDto.documents) {
        // Replace with provided documents
        updateData.projectDocuments = updateJobDto.documents;
      }

      // Update the job
      const updatedJob = await this.jobModel.findByIdAndUpdate(
        jobId,
        updateData,
        { new: true },
      )
        .populate('company', 'companyName workEmail phoneNumber')
        .populate('assignedTo', 'fullName email primaryTrade')
        .exec();

      if (!updatedJob) {
        throw new HttpException('Failed to update job', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      this.logger.log(`Job updated: ${updatedJob.jobTitle} (ID: ${jobId})`);

      return updatedJob;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a job and all related records (offers, applications, compliance)
   * Only the company that created the job can delete it
   */
  async deleteJob(jobId: string, companyId: string): Promise<void> {
    try {
      // Find the job and verify it exists
      const job = await this.jobModel.findById(jobId);

      if (!job) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      // Verify the company owns this job
      if (job.company.toString() !== companyId) {
        throw new HttpException(
          'You do not have permission to delete this job',
          HttpStatus.FORBIDDEN,
        );
      }

      // Prevent deletion if job is in progress or completed
      if (job.status === 'in_progress' || job.status === 'completed') {
        throw new HttpException(
          `Cannot delete job with status: ${job.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Deleting job: ${job.jobTitle} (ID: ${jobId})`);

      // Delete all related offers
      const deletedOffers = await this.offerModel.deleteMany({ job: jobId });
      this.logger.log(`Deleted ${deletedOffers.deletedCount} offers for job ${jobId}`);

      // Delete all related job applications
      const deletedApplications = await this.applicationModel.deleteMany({ job: jobId });
      this.logger.log(`Deleted ${deletedApplications.deletedCount} applications for job ${jobId}`);

      // Delete compliance record
      const deletedCompliance = await this.complianceModel.deleteOne({ project: jobId });
      this.logger.log(`Deleted compliance record for job ${jobId}`);

      // Finally, delete the job itself
      await this.jobModel.findByIdAndDelete(jobId);
      this.logger.log(`Job deleted successfully: ${jobId}`);

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
