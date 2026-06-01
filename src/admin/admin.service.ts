import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Admin, AdminDocument, AdminRole } from './schema/admin.schema';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/schema/subcontractor.schema';
import { Company, CompanyDocument } from '../company/schema/company.schema';
import { Invoice, InvoiceDocument } from '../invoice/schema/invoice.schema';
import { Job, JobDocument } from '../job/schema/job.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
  ) {}

  // ─── ADMIN MANAGEMENT ─────────────────────────────────────────────

  async createAdmin(dto: CreateAdminDto): Promise<Admin> {
    const existing = await this.adminModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new HttpException('An admin with this email already exists', HttpStatus.BAD_REQUEST);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = new this.adminModel({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      role: dto.role ?? AdminRole.SUPPORT,
      permissions: dto.permissions ?? [],
    });

    return admin.save();
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    return this.adminModel.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string): Promise<AdminDocument | null> {
    return this.adminModel.findById(id).select('-password -resetToken -resetTokenExpires');
  }

  async getAllAdmins(): Promise<Admin[]> {
    return this.adminModel.find().select('-password -resetToken -resetTokenExpires').sort({ createdAt: -1 });
  }

  async updateLastLogin(adminId: string): Promise<void> {
    await this.adminModel.findByIdAndUpdate(adminId, { lastLoginAt: new Date() });
  }

  // ─── SUBCONTRACTORS ───────────────────────────────────────────────

  async getAllSubcontractors(page = 1): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.subcontractorModel
        .find()
        .select('-password -resetToken -resetTokenExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.subcontractorModel.countDocuments(),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getSubcontractorById(id: string): Promise<any> {
    const sub = await this.subcontractorModel
      .findById(id)
      .select('-password -resetToken -resetTokenExpires');
    if (!sub) throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
    return sub;
  }

  // ─── COMPANIES ────────────────────────────────────────────────────

  async getAllCompanies(page = 1): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.companyModel
        .find()
        .select('-password -resetToken -resetTokenExpires -stripeCustomerId -stripeDefaultPaymentMethodId -hmrcAccessToken -hmrcRefreshToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.companyModel.countDocuments(),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getCompanyById(id: string): Promise<any> {
    const company = await this.companyModel
      .findById(id)
      .select('-password -resetToken -resetTokenExpires -stripeCustomerId -stripeDefaultPaymentMethodId -hmrcAccessToken -hmrcRefreshToken');
    if (!company) throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
    return company;
  }

  // ─── INVOICES ─────────────────────────────────────────────────────

  async getAllInvoices(page = 1, paymentStatus?: string): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const limit = 20;
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .populate('company', 'companyName workEmail')
        .populate('job', 'jobTitle trade siteAddress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.invoiceModel.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getInvoiceById(id: string): Promise<any> {
    const invoice = await this.invoiceModel
      .findById(id)
      .populate('company', 'companyName workEmail phoneNumber')
      .populate('job', 'jobTitle trade siteAddress timelineStartDate timelineEndDate');
    if (!invoice) throw new HttpException('Invoice not found', HttpStatus.NOT_FOUND);
    return invoice;
  }

  // ─── OVERVIEW STATS ───────────────────────────────────────────────

  async getOverviewStats(): Promise<any> {
    const [
      totalSubcontractors,
      totalCompanies,
      totalJobs,
      totalInvoices,
      revenueAgg,
    ] = await Promise.all([
      this.subcontractorModel.countDocuments(),
      this.companyModel.countDocuments(),
      this.jobModel.countDocuments(),
      this.invoiceModel.countDocuments(),
      this.invoiceModel.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, fees: { $sum: '$totalPlatformFee' } } },
      ]),
    ]);

    const totalRevenue = parseFloat((revenueAgg[0]?.total ?? 0).toFixed(2));
    const totalPlatformFees = parseFloat((revenueAgg[0]?.fees ?? 0).toFixed(2));

    return {
      totalSubcontractors,
      totalCompanies,
      totalJobs,
      totalInvoices,
      totalRevenue,
      totalPlatformFees,
    };
  }
}
