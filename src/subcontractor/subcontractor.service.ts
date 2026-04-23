import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { Subcontractor, SubcontractorDocument } from './schema/subcontractor.schema';
import { Invoice, InvoiceDocument } from '../invoice/schema/invoice.schema';
import { SignUpSubcontractorDto } from './dto/signup-subcontractor.dto';
import { S3UploadService } from '../common/service/s3-upload.service';
import { OpenAiService } from '../common/service/openai.service';
import { StripeService } from '../stripe/stripe.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SubcontractorService {
  constructor(
    @InjectModel(Subcontractor.name)
    private subcontractorModel: Model<SubcontractorDocument>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    private jwtService: JwtService,
    private s3UploadService: S3UploadService,
    private openAiService: OpenAiService,
    private stripeService: StripeService,
  ) { }

  async uploadDocumentWithExpiry(
    file: Express.Multer.File,
    documentType: 'insurance' | 'tickets' | 'certification',
  ): Promise<{ url: string; expiresAt: string | null }> {
    const folderMap = {
      insurance: 'subcontractors/insurance',
      tickets: 'subcontractors/tickets',
      certification: 'subcontractors/certification',
    };

    // Upload file to S3
    const url = await this.s3UploadService.uploadFile(file, folderMap[documentType]);

    // Convert buffer to base64 for OpenAI vision
    const base64 = file.buffer.toString('base64');
    const expiresAt = await this.openAiService.extractExpiryDate(base64, file.mimetype);

    return { url, expiresAt };
  }

  async signUp(
    signUpSubcontractorDto: SignUpSubcontractorDto,
    files?: {
      profileImage?: Express.Multer.File[];
      workExamples?: Express.Multer.File[];
    },
  ): Promise<Subcontractor> {
    const hashedPassword = await bcrypt.hash(signUpSubcontractorDto.password, 10);

    let profileImageUrl: string | undefined;
    let workExamplesUrls: string[] = [];

    if (files) {
      // Upload profile image to S3
      if (files.profileImage?.length) {
        profileImageUrl = await this.s3UploadService.uploadFile(
          files.profileImage[0],
          'subcontractors/profile-images',
        );
      }

      // Upload work examples to S3
      if (files.workExamples?.length) {
        workExamplesUrls = await this.s3UploadService.uploadMultipleFiles(
          files.workExamples,
          'subcontractors/work-examples',
        );
      }
    }

    // CIS deduction defaults to 30% — admin verifies manually via HMRC dashboard
    const cisDeductionRate = 30;

    // Helper: normalize flat URL field to array
    const toArray = (val?: string | string[]): string[] => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    };

    const newSubcontractor = new this.subcontractorModel({
      ...signUpSubcontractorDto,
      password: hashedPassword,
      insurance: {
        documents: toArray(signUpSubcontractorDto.insuranceDocuments),
        expiresAt: signUpSubcontractorDto.insurance?.expiresAt || null,
      },
      tickets: {
        documents: toArray(signUpSubcontractorDto.ticketsDocuments),
        expiresAt: signUpSubcontractorDto.tickets?.expiresAt || null,
      },
      certification: {
        documents: toArray(signUpSubcontractorDto.certificationDocuments),
        expiresAt: signUpSubcontractorDto.certification?.expiresAt || null,
      },
      profileImage: profileImageUrl || signUpSubcontractorDto.profileImage,
      workExamples: workExamplesUrls.length > 0 ? workExamplesUrls : signUpSubcontractorDto.workExamples,
      utr: signUpSubcontractorDto.utr,
      nino: signUpSubcontractorDto.nino,
      cisDeductionRate,
    });

    const saved = await newSubcontractor.save();

    // Auto-create Stripe Express account for this subcontractor
    try {
      const account = await this.stripeService.createExpressAccount(
        signUpSubcontractorDto.email,
      );
      await this.subcontractorModel.findByIdAndUpdate(saved._id, {
        stripeAccountId: account.id,
      });
    } catch (err) {
      // Non-fatal — can retry via onboarding-link endpoint
      console.error('Stripe Express account creation failed:', err.message);
    }

    return saved;
  }

  async findByEmail(email: string): Promise<Subcontractor | null> {
    return this.subcontractorModel.findOne({ email: email }).exec();
  }

  async updateProfile(
    userId: string,
    updateDto: any,
    files?: {
      insuranceDocuments?: Express.Multer.File[];
      ticketsDocuments?: Express.Multer.File[];
      certificationDocuments?: Express.Multer.File[];
      profileImage?: Express.Multer.File[];
    },
  ): Promise<Subcontractor> {
    const subcontractor = await this.subcontractorModel.findById(userId);
    if (!subcontractor) {
      throw new Error('Subcontractor not found');
    }

    // Build update object with only provided fields
    const updateData: any = {};

    if (updateDto.fullName !== undefined) updateData.fullName = updateDto.fullName;
    if (updateDto.primaryTrade !== undefined) updateData.primaryTrade = updateDto.primaryTrade;
    if (updateDto.hourlyRate !== undefined) updateData.hourlyRate = updateDto.hourlyRate;
    if (updateDto.professionalBio !== undefined) updateData.professionalBio = updateDto.professionalBio;
    if (updateDto.availability !== undefined) updateData.availability = updateDto.availability;
    if (updateDto.postcode !== undefined) updateData.postcode = updateDto.postcode;
    if (updateDto.cityLocation !== undefined) updateData.cityLocation = updateDto.cityLocation;
    if (updateDto.phoneNumber !== undefined) updateData.phoneNumber = updateDto.phoneNumber;
    if (updateDto.yearsOfExperience !== undefined) updateData.yearsOfExperience = updateDto.yearsOfExperience;
    if (updateDto.jobAlerts !== undefined) updateData.jobAlerts = updateDto.jobAlerts;
    if (updateDto.timesheetReminders !== undefined) updateData.timesheetReminders = updateDto.timesheetReminders;

    // Handle password change
    if (updateDto.newPassword) {
      updateData.password = await bcrypt.hash(updateDto.newPassword, 10);
    }

    // Handle file uploads
    if (files) {
      // Upload and update profile image
      if (files.profileImage?.length) {
        updateData.profileImage = await this.s3UploadService.uploadFile(
          files.profileImage[0],
          'subcontractors/profile-images',
        );
      }

      // Upload and replace insurance documents
      if (files.insuranceDocuments?.length) {
        const newUrls = await this.s3UploadService.uploadMultipleFiles(
          files.insuranceDocuments,
          'subcontractors/insurance',
        );
        updateData.insurance = {
          documents: newUrls,
          expiresAt: updateDto.insurance?.expiresAt || subcontractor.insurance?.expiresAt || null,
        };
      } else if (updateDto.insurance) {
        updateData.insurance = {
          documents: updateDto.insurance.documents || subcontractor.insurance?.documents || [],
          expiresAt: updateDto.insurance.expiresAt || subcontractor.insurance?.expiresAt || null,
        };
      }

      // Upload and replace tickets documents
      if (files.ticketsDocuments?.length) {
        const newUrls = await this.s3UploadService.uploadMultipleFiles(
          files.ticketsDocuments,
          'subcontractors/tickets',
        );
        updateData.tickets = {
          documents: newUrls,
          expiresAt: updateDto.tickets?.expiresAt || subcontractor.tickets?.expiresAt || null,
        };
      } else if (updateDto.tickets) {
        updateData.tickets = {
          documents: updateDto.tickets.documents || subcontractor.tickets?.documents || [],
          expiresAt: updateDto.tickets.expiresAt || subcontractor.tickets?.expiresAt || null,
        };
      }

      // Upload and replace certification documents
      if (files.certificationDocuments?.length) {
        const newUrls = await this.s3UploadService.uploadMultipleFiles(
          files.certificationDocuments,
          'subcontractors/certification',
        );
        updateData.certification = {
          documents: newUrls,
          expiresAt: updateDto.certification?.expiresAt || subcontractor.certification?.expiresAt || null,
        };
      } else if (updateDto.certification) {
        updateData.certification = {
          documents: updateDto.certification.documents || subcontractor.certification?.documents || [],
          expiresAt: updateDto.certification.expiresAt || subcontractor.certification?.expiresAt || null,
        };
      }
    }

    const updated = await this.subcontractorModel
      .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
      .select('-password -resetToken -resetTokenExpires')
      .exec();

    if (!updated) {
      throw new Error('Failed to update profile');
    }

    return updated;
  }

  // ─── STRIPE CONNECT ───────────────────────────────────────

  /**
   * Generates a Stripe-hosted onboarding URL for the subcontractor to
   * complete KYC + bank account setup. The Express account was already
   * created on signup. Call this whenever the subcontractor clicks
   * "Complete your Stripe setup" in the app.
   */
  async getOnboardingLink(subcontractorId: string): Promise<{ url: string }> {
    const sub = await this.subcontractorModel.findById(subcontractorId);
    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);

    // If Stripe account creation failed at signup, create it now
    if (!sub.stripeAccountId) {
      const account = await this.stripeService.createExpressAccount(sub.email);
      await this.subcontractorModel.findByIdAndUpdate(subcontractorId, {
        stripeAccountId: account.id,
      });
      sub.stripeAccountId = account.id;
    }

    const url = await this.stripeService.createAccountLink(sub.stripeAccountId!);
    return { url };
  }

  async getOnboardingStatus(subcontractorId: string): Promise<{
    connected: boolean;
    complete: boolean;
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
  }> {
    const sub = await this.subcontractorModel.findById(subcontractorId);
    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);

    if (!sub.stripeAccountId) {
      return { connected: false, complete: false, detailsSubmitted: false, chargesEnabled: false };
    }

    const account = await this.stripeService.retrieveAccount(sub.stripeAccountId);
    return {
      connected: true,
      complete: sub.stripeOnboardingComplete,
      detailsSubmitted: account.details_submitted ?? false,
      chargesEnabled: account.charges_enabled ?? false,
    };
  }

  async getBalance(subcontractorId: string): Promise<any> {
    const sub = await this.subcontractorModel.findById(subcontractorId);
    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
    if (!sub.stripeAccountId || !sub.stripeOnboardingComplete) {
      throw new HttpException(
        'Stripe account not connected or onboarding not complete',
        HttpStatus.BAD_REQUEST,
      );
    }
    const balance = await this.stripeService.retrieveBalance(sub.stripeAccountId);
    const available = balance.available.map(b => ({
      amount: b.amount / 100,
      currency: b.currency.toUpperCase(),
    }));
    const pending = balance.pending.map(b => ({
      amount: b.amount / 100,
      currency: b.currency.toUpperCase(),
    }));
    return { available, pending };
  }

  async getPayoutMethod(subcontractorId: string): Promise<any> {
    const sub = await this.subcontractorModel.findById(subcontractorId);
    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);

    if (!sub.stripeAccountId) return null;

    const bankAccount = await this.stripeService.getExternalAccount(sub.stripeAccountId);
    if (!bankAccount) return null;

    return {
      id: bankAccount.id,
      bankName: bankAccount.bank_name,
      last4: bankAccount.last4,
      routingNumber: bankAccount.routing_number,
      currency: bankAccount.currency?.toUpperCase(),
      country: bankAccount.country,
      status: bankAccount.status,
    };
  }

  async getWallet(subcontractorId: string): Promise<any> {
    const sub = await this.subcontractorModel.findById(subcontractorId);
    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
    if (!sub.stripeAccountId || !sub.stripeOnboardingComplete) {
      throw new HttpException(
        'Stripe account not connected or onboarding not complete',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Fetch live balance from Stripe
    const balance = await this.stripeService.retrieveBalance(sub.stripeAccountId);
    const available = balance.available.map(b => ({
      amount: Math.max(0, b.amount / 100),
      currency: b.currency.toUpperCase(),
    }));
    const pending = balance.pending.map(b => ({
      amount: b.amount / 100,
      currency: b.currency.toUpperCase(),
    }));

    // Fetch all paid invoices that include this subcontractor in a line item
    const subObjId = new Types.ObjectId(subcontractorId);
    const invoices = await this.invoiceModel
      .find({
        'lineItems.subcontractor': subObjId,
        'lineItems.paid': true,
      })
      .populate('company', 'companyName profileImage')
      .populate('job', 'jobTitle trade')
      .sort({ paidAt: -1 })
      .exec();

    // Flatten to one transaction entry per line item for this subcontractor
    const transactions = invoices.flatMap((invoice) => {
      return invoice.lineItems
        .filter(
          (li) =>
            li.subcontractor.toString() === subcontractorId && li.paid,
        )
        .map((li) => ({
          invoiceNumber: invoice.invoiceNumber,
          weekNumber: invoice.weekNumber,
          weekStartDate: invoice.weekStartDate,
          paidAt: invoice.paidAt,
          company: invoice.company,
          job: invoice.job,
          hours: li.hours,
          hourlyRate: li.hourlyRate,
          grossAmount: li.grossAmount,
          platformFee: li.platformFee,
          netPayable: li.netPayable,
        }));
    });

    return { available, pending, transactions };
  }

  async withdraw(subcontractorId: string): Promise<any> {
    const sub = await this.subcontractorModel.findById(subcontractorId);
    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
    if (!sub.stripeAccountId || !sub.stripeOnboardingComplete) {
      throw new HttpException(
        'Stripe account not connected or onboarding not complete',
        HttpStatus.BAD_REQUEST,
      );
    }
    const balance = await this.stripeService.retrieveBalance(sub.stripeAccountId);
    const available = balance.available.find(b => b.currency === 'gbp');
    if (!available || available.amount <= 0) {
      throw new HttpException('No available balance to withdraw', HttpStatus.BAD_REQUEST);
    }
    const payout = await this.stripeService.createPayout(
      available.amount,
      sub.stripeAccountId,
    );
    return { payoutId: payout.id, amount: available.amount / 100, currency: 'GBP' };
  }
}
