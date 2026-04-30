
import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Request,
  HttpException,
  HttpStatus,
  Logger,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  HttpCode,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SubcontractorService } from './subcontractor.service';
import { JobService } from '../job/job.service';
import { OfferService } from '../offer/offer.service';
import { SignUpSubcontractorDto } from './dto/signup-subcontractor.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubcontractorGuard } from '../auth/guards/subcontractor.guard';

@Controller('subcontractor')
export class SubcontractorController {
  private readonly logger = new Logger(SubcontractorController.name);

  constructor(
    private readonly subcontractorService: SubcontractorService,
    private readonly jobService: JobService,
    private readonly offerService: OfferService,
  ) { }

  /**
   * POST /subcontractor/upload-document
   * Public — called before signup. Uploads a single document to S3
   * and uses OpenAI vision to extract the expiry date.
   * Returns { url, expiresAt } to be passed into the signup payload.
   */
  @Post('upload-document')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  async uploadDocument(
    @Body('documentType') documentType: 'insurance' | 'tickets' | 'certification',
    @UploadedFiles() files: { file?: Express.Multer.File[] },
  ) {
    if (!files?.file?.length) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    if (!['insurance', 'tickets', 'certification'].includes(documentType)) {
      throw new HttpException(
        'documentType must be one of: insurance, tickets, certification',
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.subcontractorService.uploadDocumentWithExpiry(
      files.file[0],
      documentType,
    );
    return { success: true, ...result };
  }

  @Post('signup')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'workExamples', maxCount: 10 },
    ]),
  )
  async signUp(
    @Body() signUpSubcontractorDto: SignUpSubcontractorDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      workExamples?: Express.Multer.File[];
    },
  ) {
    // Check if subcontractor already exists
    const existingSubcontractor = await this.subcontractorService.findByEmail(
      signUpSubcontractorDto.email,
    );
    if (existingSubcontractor) {
      throw new HttpException(
        'Subcontractor with this email already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const subcontractor = await this.subcontractorService.signUp(
      signUpSubcontractorDto,
      files,
    );

    this.logger.log(
      `Subcontractor signup successful - Email: ${signUpSubcontractorDto.email}, Name: ${signUpSubcontractorDto.fullName}`,
    );

    return {
      message: 'Subcontractor registered successfully',
    };
  }

  @Put('update-profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'insuranceDocuments', maxCount: 5 },
      { name: 'ticketsDocuments', maxCount: 5 },
      { name: 'certificationDocuments', maxCount: 5 },
      { name: 'profileImage', maxCount: 1 },
    ]),
  )
  async updateProfile(
    @Request() req,
    @Body() updateDto: UpdateSubcontractorDto,
    @UploadedFiles()
    files: {
      insuranceDocuments?: Express.Multer.File[];
      ticketsDocuments?: Express.Multer.File[];
      certificationDocuments?: Express.Multer.File[];
      profileImage?: Express.Multer.File[];
    },
  ) {
    try {
      const userId = req.user.sub;

      const updatedProfile = await this.subcontractorService.updateProfile(
        userId,
        updateDto,
        files,
      );

      this.logger.log(`Subcontractor profile updated - ID: ${userId}`);

      return {
        message: 'Profile updated successfully',
        profile: updatedProfile,
      };
    } catch (error) {
      if (error.message === 'Subcontractor not found') {
        throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
      }
      if (error.message === 'Email already in use') {
        throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        error.message || 'Failed to update profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('bookings')
  @UseGuards(JwtAuthGuard)
  async getBookings(@Request() req) {
    try {
      const subcontractorId = req.user.sub;

      // Get offers with compliance documents
      const offers = await this.offerService.getOffersWithComplianceBySubcontractor(subcontractorId);

      // Get jobs where subcontractor is assigned
      const assignedJobs = await this.jobService.getJobsBySubcontractor(subcontractorId);

      // Filter offers by status
      const pendingOffers = offers.filter(offer => offer.status === 'pending');

      // Group assigned jobs by status
      const pendingJobs = assignedJobs.filter(job => job.status === 'pending');
      const inProgressJobs = assignedJobs.filter(job => job.status === 'in_progress');
      const completedJobs = assignedJobs.filter(job => job.status === 'completed');

      this.logger.log(`Fetched bookings for subcontractor - ID: ${subcontractorId}`);

      return {
        offers: pendingOffers,
        pending: pendingJobs,
        inProgress: inProgressJobs,
        completed: completedJobs,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch bookings: ${error.message}`);
      throw new HttpException(
        'Failed to fetch bookings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── PAYOUT METHOD ─────────────────────────────────

  /**
   * GET /subcontractor/payout-method
   * Returns the subcontractor's linked bank account details from Stripe.
   */
  @Get('payout-method')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  async getPayoutMethod(@Request() req) {
    const data = await this.subcontractorService.getPayoutMethod(req.user.sub);
    return { success: true, data };
  }

  // ─── WALLET ────────────────────────────────────────

  /**
   * GET /subcontractor/wallet
   * Returns the subcontractor's Stripe balance (available + pending)
   * and a full transaction history of received payments.
   */
  @Get('wallet')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  async getWallet(@Request() req) {
    return this.subcontractorService.getWallet(req.user.sub);
  }

  // ─── STRIPE CONNECT ────────────────────────────────

  /**
   * POST /subcontractor/onboarding-link
   * Returns a Stripe-hosted URL where the subcontractor completes
   * KYC + bank account setup. The Express account was already created
   * at signup. Frontend should redirect the user to the returned URL.
   */
  @Post('onboarding-link')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  @HttpCode(HttpStatus.OK)
  async getOnboardingLink(@Request() req) {
    return this.subcontractorService.getOnboardingLink(req.user.sub);
  }

  /**
   * GET /subcontractor/:id/onboarding-status
   * Returns whether the subcontractor has completed Stripe onboarding.
   */
  @Get(':id/onboarding-status')
  @UseGuards(JwtAuthGuard)
  async getOnboardingStatus(@Param('id') id: string) {
    return this.subcontractorService.getOnboardingStatus(id);
  }

  /**
   * GET /subcontractor/:id/balance
   * Returns the subcontractor's available Stripe balance (funds ready to pay out).
   */
  @Get(':id/balance')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  async getBalance(@Param('id') id: string) {
    return this.subcontractorService.getBalance(id);
  }

  /**
   * POST /subcontractor/:id/withdraw
   * Triggers a manual payout of the specified amount to the
   * subcontractor's bank account registered in Stripe.
   */
  @Post(':id/withdraw')
  @UseGuards(JwtAuthGuard, SubcontractorGuard)
  @HttpCode(HttpStatus.OK)
  async withdraw(@Param('id') id: string, @Body() body: WithdrawDto) {
    return this.subcontractorService.withdraw(id, body.amount);
  }
}
