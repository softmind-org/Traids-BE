import {
  Controller,
  Post,
  Put,
  Patch,
  Body,
  Request,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  HttpCode,
  Get,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CompanyService } from './company.service';
import { SignUpCompanyDto } from './dto/signup-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) { }

  @Post('signup')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'companyDocuments', maxCount: 10 },
      { name: 'insuranceCertificate', maxCount: 1 },
      { name: 'healthAndSafetyPolicy', maxCount: 1 },
    ]),
  )
  async signUp(
    @Body() signUpCompanyDto: SignUpCompanyDto,
    @UploadedFiles()
    files: {
      companyDocuments?: Express.Multer.File[];
      insuranceCertificate?: Express.Multer.File[];
      healthAndSafetyPolicy?: Express.Multer.File[];
    },
  ) {
    // Check if company already exists
    const existingCompanyByEmail = await this.companyService.findByEmail(
      signUpCompanyDto.workEmail,
    );
    if (existingCompanyByEmail) {
      throw new HttpException(
        'Company with this email already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingCompanyByRegNo =
      await this.companyService.findByRegistrationNumber(
        signUpCompanyDto.registrationNumber,
      );
    if (existingCompanyByRegNo) {
      throw new HttpException(
        'Company with this registration number already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const company = await this.companyService.signUp(signUpCompanyDto, files);

    return {
      message: 'Company registered successfully',
    };
  }

  @Put('update-profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'companyDocuments', maxCount: 10 },
      { name: 'insuranceCertificate', maxCount: 1 },
      { name: 'healthAndSafetyPolicy', maxCount: 1 },
    ]),
  )
  async updateProfile(
    @Request() req,
    @Body() updateDto: UpdateCompanyDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      companyDocuments?: Express.Multer.File[];
      insuranceCertificate?: Express.Multer.File[];
      healthAndSafetyPolicy?: Express.Multer.File[];
    },
  ) {
    try {
      const userId = req.user.sub;

      const updatedProfile = await this.companyService.updateProfile(
        userId,
        updateDto,
        files,
      );

      return {
        message: 'Profile updated successfully',
        profile: updatedProfile,
      };
    } catch (error) {
      if (error.message === 'Company not found') {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        error.message || 'Failed to update profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /company/setup-intent
   * Returns a Stripe SetupIntent clientSecret so Stripe.js can collect
   * and save the company's card without charging it yet.
   */
  @Post('setup-intent')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async createSetupIntent(@Request() req) {
    const result = await this.companyService.createSetupIntent(req.user.sub);
    return { success: true, ...result };
  }

  /**
   * POST /company/save-payment-method
   * Attaches a paymentMethodId (from Stripe.js) to the company's Stripe
   * Customer and sets it as the default for future invoice charges.
   */
  @Post('save-payment-method')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async savePaymentMethod(
    @Body() body: { paymentMethodId: string },
    @Request() req,
  ) {
    await this.companyService.savePaymentMethod(req.user.sub, body.paymentMethodId);
    return { success: true, message: 'Payment method saved successfully' };
  }

  /**
   * GET /company/payment-method
   * Retrieves the saved card details (brand, last4, exp date) for the UI.
   */
  @Get('payment-method')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getPaymentMethod(@Request() req) {
    const paymentMethod = await this.companyService.getPaymentMethod(req.user.sub);
    return { success: true, data: paymentMethod };
  }

  /**
   * PATCH /company/hmrc-settings
   * Saves the company's UTR and Employer Reference needed for CIS verification.
   */
  @Patch('hmrc-settings')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateHmrcSettings(
    @Request() req: { user: { sub: string } },
    @Body() body: { utr?: string; employerReference?: string },
  ) {
    const result = await this.companyService.updateHmrcSettings(req.user.sub, body);
    return { success: true, data: result };
  }
}
