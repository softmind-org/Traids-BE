import { Injectable, HttpException, HttpStatus, ConsoleLogger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Offer, OfferDocument, OfferStatus } from './schema/offer.schema';
import { Job, JobDocument } from '../job/schema/job.schema';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/schema/subcontractor.schema';
import { Company, CompanyDocument } from '../company/schema/company.schema';
import { JobApplication, JobApplicationDocument, ApplicationStatus } from '../job-application/schema/job-application.schema';
import { CreateOfferDto } from './dto/create-offer.dto';
import { S3UploadService } from '../common/service/s3-upload.service';
import { SubcontractorSocketService } from '../socket/subcontractorSocket.service';
import { CompanySocketService } from '../socket/companySocket.service';
import { ComplianceService } from '../compliance/compliance.service';

@Injectable()
export class OfferService {
  constructor(
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(JobApplication.name) private jobApplicationModel: Model<JobApplicationDocument>,
    private s3UploadService: S3UploadService,
    private subcontractorSocketService: SubcontractorSocketService,
    private companySocketService: CompanySocketService,
    private complianceService: ComplianceService,
  ) { }

  async sendOffer(
    createOfferDto: CreateOfferDto,
    companyId: string,
    files?: Express.Multer.File[],
  ): Promise<Offer> {
    try {
      // Validate subcontractor exists
      if (!Types.ObjectId.isValid(createOfferDto.subcontractorId)) {
        throw new HttpException('Invalid subcontractor ID', HttpStatus.BAD_REQUEST);
      }

      const subcontractor = await this.subcontractorModel
        .findById(createOfferDto.subcontractorId)
        .exec();
      if (!subcontractor) {
        throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
      }

      // Upload documents to S3 if provided
      let documentUrls: string[] = [];
      if (files && files.length > 0) {
        documentUrls = await this.s3UploadService.uploadMultipleFiles(
          files,
          'jobs/documents',
        );
      }

      // Step 1: Create a new Job first
      const newJob = new this.jobModel({
        company: new Types.ObjectId(companyId),
        jobTitle: createOfferDto.jobTitle,
        trade: createOfferDto.trade,
        description: createOfferDto.description,
        siteAddress: createOfferDto.siteAddress,
        timelineStartDate: new Date(createOfferDto.timelineStartDate),
        timelineEndDate: new Date(createOfferDto.timelineEndDate),
        typeOfJob: 'offer',
        hourlyRate: createOfferDto.hourlyRate,
        projectDocuments: documentUrls,
      });

      const savedJob = await newJob.save();

      // Step 2: Create compliance record for the job
      await this.complianceService.createCompliance(
        createOfferDto.jobTitle,
        savedJob._id.toString(),
      );

      // Step 3: Create the Offer with the new Job ID
      const offer = new this.offerModel({
        job: savedJob._id,
        company: new Types.ObjectId(companyId),
        subcontractor: new Types.ObjectId(createOfferDto.subcontractorId),
        status: OfferStatus.PENDING,
        sentAt: new Date(),
        expiresAt: createOfferDto.expiresAt ? new Date(createOfferDto.expiresAt) : undefined,
      });

      const savedOffer = await offer.save();

      // Return populated offer
      const populatedOffer = await this.offerModel
        .findById(savedOffer._id)
        .populate('job')
        .populate('company', 'companyName workEmail phoneNumber')
        .populate('subcontractor', 'fullName email primaryTrade hourlyRate')
        .exec();

      if (!populatedOffer) {
        throw new HttpException('Failed to retrieve created offer', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Get company details for notification
      const company = await this.companyModel.findById(companyId).exec();

      // Send real-time notification to subcontractor
      this.subcontractorSocketService.notifyOfferReceived(createOfferDto.subcontractorId, {
        offerId: savedOffer._id.toString(),
        jobTitle: createOfferDto.jobTitle,
        companyName: company?.companyName || 'A company',
        companyId: companyId,
        hourlyRate: createOfferDto.hourlyRate,
      });

      return populatedOffer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to send offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOffersByCompany(companyId: string): Promise<Offer[]> {
    return await this.offerModel
      .find({ company: new Types.ObjectId(companyId) })
      .populate('job')
      .populate('subcontractor', 'fullName email primaryTrade hourlyRate profileImage')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getOffersBySubcontractor(subcontractorId: string): Promise<Offer[]> {
    return await this.offerModel
      .find({ subcontractor: new Types.ObjectId(subcontractorId) })
      .populate('job')
      .populate('company', 'companyName workEmail phoneNumber headOfficeAddress')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getOffersWithComplianceBySubcontractor(subcontractorId: string): Promise<any[]> {
    try {
      const offers = await this.offerModel
        .find({ subcontractor: new Types.ObjectId(subcontractorId) })
        .populate('job')
        .populate('company', 'companyName workEmail phoneNumber headOfficeAddress profileImage')
        .sort({ createdAt: -1 })
        .exec();

      // For each offer, fetch the compliance documents for the job
      const offersWithCompliance = await Promise.all(
        offers.map(async (offer) => {
          const offerObj = offer.toObject();
          const jobId = offerObj.job?._id?.toString();

          if (jobId) {
            try {
              const compliance = await this.complianceService.getComplianceByProject(jobId);
              return {
                ...offerObj,
                compliance: compliance,
              };
            } catch (error) {
              // If compliance not found, just return offer without compliance
              return {
                ...offerObj,
                compliance: null,
              };
            }
          }

          return {
            ...offerObj,
            compliance: null,
          };
        })
      );

      return offersWithCompliance;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch offers with compliance',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOffersForJob(jobId: string): Promise<Offer[]> {
    return await this.offerModel
      .find({ job: new Types.ObjectId(jobId) })
      .populate('subcontractor', 'fullName email primaryTrade hourlyRate yearsOfExperience cityLocation averageRating profileImage professionalBio')
      .sort({ sentAt: -1 })
      .exec();
  }

  async getAcceptedOffer(jobId: string): Promise<Offer | null> {
    return await this.offerModel
      .findOne({ job: new Types.ObjectId(jobId), status: OfferStatus.ACCEPTED })
      .populate('subcontractor', 'fullName email primaryTrade hourlyRate yearsOfExperience cityLocation averageRating profileImage professionalBio')
      .exec();
  }

  /**
   * Send an existing job as an offer to a subcontractor
   * Does not create a new job, just creates an offer document
   */
  async sendExistingJobAsOffer(
    jobId: string,
    subcontractorId: string,
    companyId: string,
    expiresAt?: string,
  ): Promise<Offer> {
    try {
      // 1. Validate job exists
      const job = await this.jobModel.findById(jobId);
      if (!job) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      // 2. Verify company owns this job
      if (job.company.toString() !== companyId) {
        throw new HttpException(
          'You do not have permission to send this job as an offer',
          HttpStatus.FORBIDDEN,
        );
      }

      // 3. Check if job is in valid status (pending or accepted, not in_progress or completed)
      if (job.status === 'in_progress' || job.status === 'completed') {
        throw new HttpException(
          `Cannot send offer for job with status: ${job.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. Check if job has worker capacity
      if (job.assignedTo && job.assignedTo.length >= job.workersRequired) {
        throw new HttpException(
          'Job has already reached maximum worker capacity',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 5. Validate subcontractor exists
      if (!Types.ObjectId.isValid(subcontractorId)) {
        throw new HttpException('Invalid subcontractor ID', HttpStatus.BAD_REQUEST);
      }

      const subcontractor = await this.subcontractorModel.findById(subcontractorId);
      if (!subcontractor) {
        throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
      }

      // 6. Check if offer already sent to this subcontractor for this job
      const existingOffer = await this.offerModel.findOne({
        job: new Types.ObjectId(jobId),
        subcontractor: new Types.ObjectId(subcontractorId),
      });

      if (existingOffer) {
        throw new HttpException(
          'An offer has already been sent to this subcontractor for this job',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 7. Create the offer (without creating a new job)
      const offer = new this.offerModel({
        job: new Types.ObjectId(jobId),
        company: new Types.ObjectId(companyId),
        subcontractor: new Types.ObjectId(subcontractorId),
        status: OfferStatus.PENDING,
        sentAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      const savedOffer = await offer.save();

      // 8. Return populated offer
      const populatedOffer = await this.offerModel
        .findById(savedOffer._id)
        .populate('job')
        .populate('company', 'companyName workEmail phoneNumber')
        .populate('subcontractor', 'fullName email primaryTrade hourlyRate')
        .exec();

      if (!populatedOffer) {
        throw new HttpException(
          'Failed to retrieve created offer',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 9. Get company details for notification
      const company = await this.companyModel.findById(companyId);

      // 10. Send real-time notification to subcontractor
      this.subcontractorSocketService.notifyOfferReceived(subcontractorId, {
        offerId: savedOffer._id.toString(),
        jobTitle: job.jobTitle,
        companyName: company?.companyName || 'A company',
        companyId: companyId,
        hourlyRate: job.hourlyRate,
      });

      return populatedOffer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to send job as offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Accept an offer by subcontractor
   */
  async acceptOffer(offerId: string, subcontractorId: string): Promise<Offer> {
    try {
      // 1. Find the offer
      const offer = await this.offerModel
        .findById(offerId)
        .populate('job')
        .populate('company', 'companyName workEmail phoneNumber')
        .populate('subcontractor', 'fullName email primaryTrade hourlyRate')
        .exec();

      if (!offer) {
        throw new HttpException('Offer not found', HttpStatus.NOT_FOUND);
      }

      // 2. Verify subcontractor owns this offer
      if (offer.subcontractor._id.toString() !== subcontractorId) {
        throw new HttpException(
          'You do not have permission to accept this offer',
          HttpStatus.FORBIDDEN,
        );
      }

      // 3. Check if offer is still pending
      if (offer.status !== OfferStatus.PENDING) {
        throw new HttpException(
          `Cannot accept offer with status: ${offer.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. Check if offer has expired
      if (offer.expiresAt && new Date() > new Date(offer.expiresAt)) {
        throw new HttpException('This offer has expired', HttpStatus.BAD_REQUEST);
      }

      // 5. Get the associated job
      const job = await this.jobModel.findById(offer.job._id);
      if (!job) {
        throw new HttpException('Associated job not found', HttpStatus.NOT_FOUND);
      }

      // 6. Check if job has worker capacity
      if (job.assignedTo && job.assignedTo.length >= job.workersRequired) {
        throw new HttpException(
          'Job has already reached maximum worker capacity',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 7. Update offer status
      offer.status = OfferStatus.ACCEPTED;
      offer.respondedAt = new Date();
      await offer.save();

      // 8. Add subcontractor to job's assignedTo array
      if (!job.assignedTo) {
        job.assignedTo = [];
      }
      if (!job.assignedTo.includes(new Types.ObjectId(subcontractorId))) {
        job.assignedTo.push(new Types.ObjectId(subcontractorId));
        await job.save();
      }

      // 9. Upsert a JobApplication record so the subcontractor appears in the
      //    job's applications list (offer-accepted path has no prior application)
      await this.jobApplicationModel.findOneAndUpdate(
        { job: job._id, subcontractor: new Types.ObjectId(subcontractorId) },
        {
          $setOnInsert: {
            company: job.company,
            fullName: (offer.subcontractor as any).fullName || '',
            appliedAt: new Date(),
          },
          $set: { status: ApplicationStatus.ACCEPTED },
        },
        { upsert: true, new: true },
      );

      // 10. Get company and subcontractor details for notification
      const company = await this.companyModel.findById(job.company).exec();
      const subcontractor = await this.subcontractorModel.findById(subcontractorId).exec();

      // 10. Send notification to company
      if (company) {
        this.companySocketService.notifyOfferAccepted(company._id.toString(), {
          offerId: offer._id.toString(),
          jobTitle: job.jobTitle,
          subcontractorName: subcontractor?.fullName || 'A subcontractor',
          subcontractorId: subcontractorId,
        });
      }

      return offer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to accept offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reject an offer by subcontractor
   */
  async rejectOffer(offerId: string, subcontractorId: string): Promise<Offer> {
    try {
      // 1. Find the offer
      const offer = await this.offerModel
        .findById(offerId)
        .populate('job')
        .populate('company', 'companyName workEmail phoneNumber')
        .populate('subcontractor', 'fullName email primaryTrade hourlyRate')
        .exec();

      if (!offer) {
        throw new HttpException('Offer not found', HttpStatus.NOT_FOUND);
      }

      // 2. Verify subcontractor owns this offer
      if (offer.subcontractor._id.toString() !== subcontractorId) {
        throw new HttpException(
          'You do not have permission to reject this offer',
          HttpStatus.FORBIDDEN,
        );
      }

      // 3. Check if offer is still pending
      if (offer.status !== OfferStatus.PENDING) {
        throw new HttpException(
          `Cannot reject offer with status: ${offer.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. Update offer status
      offer.status = OfferStatus.REJECTED;
      offer.respondedAt = new Date();
      await offer.save();

      // 5. Get job and company details for notification
      const job = await this.jobModel.findById(offer.job._id).exec();
      const company = await this.companyModel.findById(job?.company).exec();
      const subcontractor = await this.subcontractorModel.findById(subcontractorId).exec();

      // 6. Send notification to company
      if (company && job) {
        this.companySocketService.notifyOfferRejected(company._id.toString(), {
          offerId: offer._id.toString(),
          jobTitle: job.jobTitle,
          subcontractorName: subcontractor?.fullName || 'A subcontractor',
          subcontractorId: subcontractorId,
        });
      }

      return offer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to reject offer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
