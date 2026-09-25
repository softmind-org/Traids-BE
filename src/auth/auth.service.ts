import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../company/schema/company.schema';
import {
  Subcontractor,
  SubcontractorDocument,
} from '../subcontractor/schema/subcontractor.schema';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetTokenDto } from './dto/verify-reset-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../common/service/email.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Subcontractor.name)
    private subcontractorModel: Model<SubcontractorDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) { }

  async login(loginDto: LoginDto): Promise<{
    user: any;
    accessToken: string;
    userType: string;
  }> {
    if (loginDto.userType === 'company') {
      return this.loginCompany(loginDto.email, loginDto.password);
    } else if (loginDto.userType === 'subcontractor') {
      return this.loginSubcontractor(loginDto.email, loginDto.password);
    }
    throw new HttpException('Invalid user type', HttpStatus.BAD_REQUEST);
  }

  private async loginCompany(
    email: string,
    password: string,
  ): Promise<{
    user: any;
    accessToken: string;
    userType: string;
  }> {
    const company = await this.companyModel
      .findOne({ workEmail: email })
      .exec();

    if (!company) {
      throw new HttpException('No account found with this email address', HttpStatus.NOT_FOUND);
    }

    const isPasswordValid = await bcrypt.compare(password, company.password);

    if (!isPasswordValid) {
      throw new HttpException('Incorrect password', HttpStatus.UNAUTHORIZED);
    }

    const payload = {
      sub: company._id,
      email: company.workEmail,
      companyName: company.companyName,
      userType: 'company',
    };

    const accessToken = this.jwtService.sign(payload);
    const { password: _, ...companyData } = company.toObject();

    return { user: companyData, accessToken, userType: 'company' };
  }

  private async loginSubcontractor(
    email: string,
    password: string,
  ): Promise<{
    user: any;
    accessToken: string;
    userType: string;
  }> {
    const subcontractor = await this.subcontractorModel
      .findOne({ email: email })
      .exec();

    if (!subcontractor) {
      throw new HttpException('No account found with this email address', HttpStatus.NOT_FOUND);
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      subcontractor.password,
    );

    if (!isPasswordValid) {
      throw new HttpException('Incorrect password', HttpStatus.UNAUTHORIZED);
    }

    const payload = {
      sub: subcontractor._id,
      email: subcontractor.email,
      fullName: subcontractor.fullName,
      primaryTrade: subcontractor.primaryTrade,
      userType: 'subcontractor',
    };

    const accessToken = this.jwtService.sign(payload);
    const { password: _, ...subcontractorData } = subcontractor.toObject();

    return {
      user: subcontractorData,
      accessToken,
      userType: 'subcontractor',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<boolean> {
    const resetCode = this.generateResetCode();
    const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (forgotPasswordDto.userType === 'company') {
      const company = await this.companyModel
        .findOne({ workEmail: forgotPasswordDto.email })
        .exec();

      if (!company) {
        throw new HttpException(
          'Company with this email not found',
          HttpStatus.NOT_FOUND,
        );
      }

      company.resetToken = resetCode;
      company.resetTokenExpires = resetTokenExpires;
      await company.save();

      await this.emailService.sendResetPasswordEmail(
        forgotPasswordDto.email,
        resetCode,
      );
      return true;
    } else if (forgotPasswordDto.userType === 'subcontractor') {
      const subcontractor = await this.subcontractorModel
        .findOne({ email: forgotPasswordDto.email })
        .exec();

      if (!subcontractor) {
        throw new HttpException(
          'Subcontractor with this email not found',
          HttpStatus.NOT_FOUND,
        );
      }

      subcontractor.resetToken = resetCode;
      subcontractor.resetTokenExpires = resetTokenExpires;
      await subcontractor.save();

      await this.emailService.sendResetPasswordEmail(
        forgotPasswordDto.email,
        resetCode,
      );
      return true;
    }

    throw new HttpException('Invalid user type', HttpStatus.BAD_REQUEST);
  }

  private generateResetCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async verifyResetToken(
    verifyResetTokenDto: VerifyResetTokenDto,
  ): Promise<boolean> {
    if (verifyResetTokenDto.userType === 'company') {
      const company = await this.companyModel
        .findOne({ workEmail: verifyResetTokenDto.email })
        .exec();

      if (!company) {
        throw new HttpException(
          'Company with this email not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!company.resetToken || !company.resetTokenExpires) {
        throw new HttpException(
          'No reset token found. Please request a new password reset',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (company.resetToken !== verifyResetTokenDto.resetToken) {
        throw new HttpException(
          'Invalid reset token',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (new Date() > company.resetTokenExpires) {
        throw new HttpException(
          'Reset token has expired. Please request a new one',
          HttpStatus.BAD_REQUEST,
        );
      }

      return true;
    } else if (verifyResetTokenDto.userType === 'subcontractor') {
      const subcontractor = await this.subcontractorModel
        .findOne({ email: verifyResetTokenDto.email })
        .exec();

      if (!subcontractor) {
        throw new HttpException(
          'Subcontractor with this email not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!subcontractor.resetToken || !subcontractor.resetTokenExpires) {
        throw new HttpException(
          'No reset token found. Please request a new password reset',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (subcontractor.resetToken !== verifyResetTokenDto.resetToken) {
        throw new HttpException(
          'Invalid reset token',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (new Date() > subcontractor.resetTokenExpires) {
        throw new HttpException(
          'Reset token has expired. Please request a new one',
          HttpStatus.BAD_REQUEST,
        );
      }

      return true;
    }

    throw new HttpException(
      'Invalid user type',
      HttpStatus.BAD_REQUEST,
    );
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<boolean> {
    if (resetPasswordDto.userType === 'company') {
      const company = await this.companyModel
        .findOne({ workEmail: resetPasswordDto.email })
        .exec();

      if (!company) {
        throw new HttpException(
          'Company with this email not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!company.resetToken || !company.resetTokenExpires) {
        throw new HttpException(
          'No reset token found. Please request a new password reset',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (company.resetToken !== resetPasswordDto.resetToken) {
        throw new HttpException(
          'Invalid reset token',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (new Date() > company.resetTokenExpires) {
        throw new HttpException(
          'Reset token has expired. Please request a new one',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

      // Update password and clear reset token
      company.password = hashedPassword;
      company.resetToken = undefined;
      company.resetTokenExpires = undefined;
      await company.save();

      return true;
    } else if (resetPasswordDto.userType === 'subcontractor') {
      const subcontractor = await this.subcontractorModel
        .findOne({ email: resetPasswordDto.email })
        .exec();

      if (!subcontractor) {
        throw new HttpException(
          'Subcontractor with this email not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!subcontractor.resetToken || !subcontractor.resetTokenExpires) {
        throw new HttpException(
          'No reset token found. Please request a new password reset',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (subcontractor.resetToken !== resetPasswordDto.resetToken) {
        throw new HttpException(
          'Invalid reset token',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (new Date() > subcontractor.resetTokenExpires) {
        throw new HttpException(
          'Reset token has expired. Please request a new one',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

      // Update password and clear reset token
      subcontractor.password = hashedPassword;
      subcontractor.resetToken = undefined;
      subcontractor.resetTokenExpires = undefined;
      await subcontractor.save();

      return true;
    }

    throw new HttpException('Invalid user type', HttpStatus.BAD_REQUEST);
  }

  async getProfile(userId: string, userType: 'company' | 'subcontractor'): Promise<any> {
    if (userType === 'company') {
      const company = await this.companyModel
        .findById(userId)
        .select('-password')
        .exec();

      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }

      return company;
    } else if (userType === 'subcontractor') {
      const subcontractor = await this.subcontractorModel
        .findById(userId)
        .select('-password')
        .exec();

      if (!subcontractor) {
        throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
      }

      return subcontractor;
    }

    throw new HttpException('Invalid user type', HttpStatus.BAD_REQUEST);
  }
}
