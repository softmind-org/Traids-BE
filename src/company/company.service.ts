import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from './schema/company.schema';
import { SignUpCompanyDto } from './dto/signup-company.dto';
import { S3UploadService } from '../common/service/s3-upload.service';
import { StripeService } from '../stripe/stripe.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private jwtService: JwtService,
    private s3UploadService: S3UploadService,
    private stripeService: StripeService,
  ) { }

  async signUp(
    signUpCompanyDto: SignUpCompanyDto,
    files?: {
      companyDocuments?: Express.Multer.File[];
      insuranceCertificate?: Express.Multer.File[];
      healthAndSafetyPolicy?: Express.Multer.File[];
    },
  ): Promise<Company> {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(signUpCompanyDto.password, 10);

    // Upload files to S3 and get URLs
    let companyDocumentsUrls: string[] = [];
    let insuranceCertificateUrl: string | undefined;
    let healthAndSafetyPolicyUrl: string | undefined;

    if (files) {
      // Upload company documents
      if (files.companyDocuments?.length) {
        companyDocumentsUrls = await this.s3UploadService.uploadMultipleFiles(
          files.companyDocuments,
          'companies/documents',
        );
      }

      // Upload insurance certificate
      if (files.insuranceCertificate?.length) {
        insuranceCertificateUrl = await this.s3UploadService.uploadFile(
          files.insuranceCertificate[0],
          'companies/insurance',
        );
      }

      // Upload health and safety policy
      if (files.healthAndSafetyPolicy?.length) {
        healthAndSafetyPolicyUrl = await this.s3UploadService.uploadFile(
          files.healthAndSafetyPolicy[0],
          'companies/health-safety',
        );
      }
    }

    const newCompany = new this.companyModel({
      ...signUpCompanyDto,
      password: hashedPassword,
      companyDocuments: companyDocumentsUrls.length > 0 ? companyDocumentsUrls : signUpCompanyDto.companyDocuments,
      insuranceCertificate: insuranceCertificateUrl || signUpCompanyDto.insuranceCertificate,
      healthAndSafetyPolicy: healthAndSafetyPolicyUrl || signUpCompanyDto.healthAndSafetyPolicy,
    });

    const saved = await newCompany.save();

    // Silently create Stripe Customer and persist the ID
    try {
      const customer = await this.stripeService.createCustomer(
        signUpCompanyDto.workEmail,
        signUpCompanyDto.companyName,
      );
      await this.companyModel.findByIdAndUpdate(saved._id, {
        stripeCustomerId: customer.id,
      });
    } catch (err) {
      // Non-fatal: Stripe customer can be created later
      console.error('Stripe customer creation failed:', err.message);
    }

    return saved;
  }

  async findByEmail(email: string): Promise<Company | null> {
    return this.companyModel.findOne({ workEmail: email }).exec();
  }

  async findByRegistrationNumber(
    registrationNumber: string,
  ): Promise<Company | null> {
    return this.companyModel
      .findOne({ registrationNumber: registrationNumber })
      .exec();
  }

  async updateProfile(
    userId: string,
    updateDto: any,
    files?: {
      profileImage?: Express.Multer.File[];
      companyDocuments?: Express.Multer.File[];
      insuranceCertificate?: Express.Multer.File[];
      healthAndSafetyPolicy?: Express.Multer.File[];
    },
  ): Promise<Company> {
    const company = await this.companyModel.findById(userId);
    if (!company) {
      throw new Error('Company not found');
    }

    const updateData: any = {};

    if (updateDto.companyName !== undefined) updateData.companyName = updateDto.companyName;
    if (updateDto.registrationNumber !== undefined) updateData.registrationNumber = updateDto.registrationNumber;
    if (updateDto.vatNumber !== undefined) updateData.vatNumber = updateDto.vatNumber;
    if (updateDto.industryType !== undefined) updateData.industryType = updateDto.industryType;
    if (updateDto.aboutUs !== undefined) updateData.aboutUs = updateDto.aboutUs;
    if (updateDto.primaryContactName !== undefined) updateData.primaryContactName = updateDto.primaryContactName;
    if (updateDto.workEmail !== undefined) updateData.workEmail = updateDto.workEmail;
    if (updateDto.phoneNumber !== undefined) updateData.phoneNumber = updateDto.phoneNumber;
    if (updateDto.headOfficeAddress !== undefined) updateData.headOfficeAddress = updateDto.headOfficeAddress;
    if (updateDto.timesheetReminders !== undefined) updateData.timesheetReminders = updateDto.timesheetReminders;

    // Handle password change
    if (updateDto.password) {
      updateData.password = await bcrypt.hash(updateDto.password, 10);
    }

    // Handle file uploads
    if (files) {
      if (files.profileImage?.length) {
        updateData.profileImage = await this.s3UploadService.uploadFile(
          files.profileImage[0],
          'companies/profile-images',
        );
      }

      if (files.companyDocuments?.length) {
        updateData.companyDocuments = await this.s3UploadService.uploadMultipleFiles(
          files.companyDocuments,
          'companies/documents',
        );
      }

      if (files.insuranceCertificate?.length) {
        updateData.insuranceCertificate = await this.s3UploadService.uploadFile(
          files.insuranceCertificate[0],
          'companies/insurance',
        );
      }

      if (files.healthAndSafetyPolicy?.length) {
        updateData.healthAndSafetyPolicy = await this.s3UploadService.uploadFile(
          files.healthAndSafetyPolicy[0],
          'companies/health-safety',
        );
      }
    }

    const updated = await this.companyModel
      .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
      .select('-password -resetToken -resetTokenExpires')
      .exec();

    if (!updated) {
      throw new Error('Failed to update profile');
    }

    return updated;
  }

  // ─── STRIPE PAYMENT METHODS ─────────────────────────────────────

  async createSetupIntent(companyId: string): Promise<{ clientSecret: string }> {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new HttpException('Company not found', HttpStatus.NOT_FOUND);

    // Auto-create Stripe Customer if missing (e.g. existing users before Stripe was added)
    if (!company.stripeCustomerId) {
      const customer = await this.stripeService.createCustomer(
        company.workEmail,
        company.companyName,
      );
      await this.companyModel.findByIdAndUpdate(companyId, {
        stripeCustomerId: customer.id,
      });
      company.stripeCustomerId = customer.id;
    }

    const intent = await this.stripeService.createSetupIntent(company.stripeCustomerId);
    return { clientSecret: intent.client_secret! };
  }

  async savePaymentMethod(
    companyId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
    if (!company.stripeCustomerId) {
      throw new HttpException(
        'Stripe customer not set up.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.stripeService.attachPaymentMethod(
      company.stripeCustomerId,
      paymentMethodId,
    );
    await this.companyModel.findByIdAndUpdate(companyId, {
      stripeDefaultPaymentMethodId: paymentMethodId,
    });
  }

  async getPaymentMethod(companyId: string): Promise<any> {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new HttpException('Company not found', HttpStatus.NOT_FOUND);

    if (!company.stripeDefaultPaymentMethodId) {
      return null;
    }

    const pm = await this.stripeService.retrievePaymentMethod(
      company.stripeDefaultPaymentMethodId,
    );

    if (!pm || !pm.card) return null;

    return {
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  }

  async updateHmrcSettings(
    companyId: string,
    settings: { utr?: string; employerReference?: string },
  ): Promise<{ utr: string | null; employerReference: string | null }> {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new HttpException('Company not found', HttpStatus.NOT_FOUND);

    const update: any = {};
    if (settings.utr !== undefined) update.utr = settings.utr;
    if (settings.employerReference !== undefined) update.employerReference = settings.employerReference;

    await this.companyModel.findByIdAndUpdate(companyId, update);

    return {
      utr: update.utr ?? company.utr ?? null,
      employerReference: update.employerReference ?? company.employerReference ?? null,
    };
  }
}
