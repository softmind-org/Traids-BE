import { Injectable, HttpException, HttpStatus, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Admin, AdminDocument, AdminRole } from './schema/admin.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { Company, CompanyDocument } from '../company/schema/company.schema';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/schema/subcontractor.schema';
import { Job, JobDocument } from '../job/schema/job.schema';
import { Invoice, InvoiceDocument, InvoicePaymentStatus } from '../invoice/schema/invoice.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    private jwtService: JwtService,
  ) { }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  async createAdmin(dto: CreateAdminDto): Promise<Omit<Admin, 'password'>> {
    const existing = await this.adminModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('An admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = new this.adminModel({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      role: dto.role ?? AdminRole.SUPPORT,
    });

    const saved = await admin.save();
    const { password: _, ...adminData } = saved.toObject();
    return adminData as any;
  }

  async loginAdmin(dto: LoginAdminDto): Promise<{ admin: any; accessToken: string }> {
    const admin = await this.adminModel.findOne({ email: dto.email.toLowerCase() });

    if (!admin) {
      throw new HttpException('No admin account found with this email', HttpStatus.NOT_FOUND);
    }

    if (!admin.isActive) {
      throw new HttpException('This admin account has been deactivated', HttpStatus.FORBIDDEN);
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new HttpException('Incorrect password', HttpStatus.UNAUTHORIZED);
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const payload = {
      sub: admin._id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      isActive: admin.isActive,
      userType: 'admin',
    };

    const accessToken = this.jwtService.sign(payload);
    const { password: _, ...adminData } = admin.toObject();

    return { admin: adminData, accessToken };
  }

  async findById(id: string): Promise<AdminDocument | null> {
    return this.adminModel.findById(id).select('-password').exec();
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    return this.adminModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async getAllAdmins(): Promise<AdminDocument[]> {
    return this.adminModel.find().select('-password').sort({ createdAt: -1 }).exec();
  }

  async updateProfile(
    adminId: string,
    fullName?: string,
    password?: string,
  ): Promise<Omit<Admin, 'password'>> {
    const admin = await this.adminModel.findById(adminId);
    if (!admin) {
      throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);
    }

    if (fullName?.trim()) {
      admin.fullName = fullName.trim();
    }

    if (password) {
      admin.password = await bcrypt.hash(password, 10);
    }

    const saved = await admin.save();
    const { password: _, ...adminData } = saved.toObject();
    return adminData as any;
  }

  async toggleActive(adminId: string): Promise<AdminDocument> {
    const admin = await this.adminModel.findById(adminId);
    if (!admin) {
      throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);
    }
    admin.isActive = !admin.isActive;
    return admin.save();
  }

  // ─── Subcontractors ──────────────────────────────────────────────────────────

  async getAllSubcontractors(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const matchStage: any = {};

    if (search?.trim()) {
      matchStage.$or = [
        { fullName: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const SENSITIVE = ['password', 'resetToken', 'resetTokenExpires', 'stripeAccountId',
      'hmrcAccessToken', 'hmrcRefreshToken', 'hmrcTokenExpiry'];

    const [data, total] = await Promise.all([
      this.subcontractorModel.aggregate([
        { $match: matchStage },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'jobs',
            let: { subId: '$_id' },
            pipeline: [
              { $match: { $expr: { $in: ['$$subId', '$assignedTo'] } } },
            ],
            as: 'jobsList',
          },
        },
        {
          $addFields: { projectsCount: { $size: '$jobsList' } },
        },
        {
          $project: {
            jobsList: 0,
            ...Object.fromEntries(SENSITIVE.map((f) => [f, 0])),
          },
        },
      ]),
      this.subcontractorModel.countDocuments(matchStage),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getSubcontractorById(id: string): Promise<any> {
    const { Types } = require('mongoose');
    const SENSITIVE = ['password', 'resetToken', 'resetTokenExpires', 'stripeAccountId',
      'hmrcAccessToken', 'hmrcRefreshToken', 'hmrcTokenExpiry'];

    const [result] = await this.subcontractorModel.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      // Jobs assigned to this subcontractor
      {
        $lookup: {
          from: 'jobs',
          let: { subId: '$_id' },
          pipeline: [
            { $match: { $expr: { $in: ['$$subId', '$assignedTo'] } } },
            { $project: { jobTitle: 1, status: 1, trade: 1, createdAt: 1 } },
          ],
          as: 'jobs',
        },
      },
      // Work history: ratings received, with job title + start date + company name
      {
        $lookup: {
          from: 'ratings',
          let: { subId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$subcontractor', '$$subId'] } } },
            {
              $lookup: {
                from: 'jobs',
                localField: 'job',
                foreignField: '_id',
                pipeline: [
                  { $project: { jobTitle: 1, timelineStartDate: 1 } },
                ],
                as: 'jobDetails',
              },
            },
            {
              $lookup: {
                from: 'companies',
                localField: 'company',
                foreignField: '_id',
                pipeline: [
                  { $project: { companyName: 1 } },
                ],
                as: 'companyDetails',
              },
            },
            {
              $project: {
                rating: 1,
                comment: 1,
                createdAt: 1,
                jobTitle: { $arrayElemAt: ['$jobDetails.jobTitle', 0] },
                jobStartDate: { $arrayElemAt: ['$jobDetails.timelineStartDate', 0] },
                companyName: { $arrayElemAt: ['$companyDetails.companyName', 0] },
              },
            },
            { $sort: { createdAt: -1 } },
          ],
          as: 'workHistory',
        },
      },
      {
        $addFields: { projectsCount: { $size: '$jobs' } },
      },
      {
        $project: {
          ...Object.fromEntries(SENSITIVE.map((f) => [f, 0])),
        },
      },
    ]);

    if (!result) {
      throw new HttpException('Subcontractor not found', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  // ─── Companies ───────────────────────────────────────────────────────────────

  async getAllCompanies(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const matchStage: any = {};

    if (search?.trim()) {
      matchStage.companyName = { $regex: search.trim(), $options: 'i' };
    }

    const SENSITIVE = ['password', 'resetToken', 'resetTokenExpires', 'stripeCustomerId',
      'stripeDefaultPaymentMethodId', 'hmrcAccessToken', 'hmrcRefreshToken', 'hmrcTokenExpiry'];

    const [data, total] = await Promise.all([
      this.companyModel.aggregate([
        { $match: matchStage },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        // Count jobs posted by this company
        {
          $lookup: {
            from: 'jobs',
            localField: '_id',
            foreignField: 'company',
            as: 'jobsList',
          },
        },
        // Sum of all paid invoices = lifetime spend
        {
          $lookup: {
            from: 'invoices',
            let: { companyId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$company', '$$companyId'] },
                  paymentStatus: InvoicePaymentStatus.PAID,
                },
              },
              { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ],
            as: 'invoiceSummary',
          },
        },
        {
          $addFields: {
            jobsCount: { $size: '$jobsList' },
            lifetimeSpend: {
              $ifNull: [{ $arrayElemAt: ['$invoiceSummary.total', 0] }, 0],
            },
          },
        },
        {
          $project: {
            jobsList: 0,
            invoiceSummary: 0,
            ...Object.fromEntries(SENSITIVE.map((f) => [f, 0])),
          },
        },
      ]),
      this.companyModel.countDocuments(matchStage),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getCompanyById(companyId: string): Promise<any> {
    const { Types } = require('mongoose');
    const SENSITIVE = ['password', 'resetToken', 'resetTokenExpires', 'stripeCustomerId',
      'stripeDefaultPaymentMethodId', 'hmrcAccessToken', 'hmrcRefreshToken', 'hmrcTokenExpiry'];

    const [result] = await this.companyModel.aggregate([
      { $match: { _id: new Types.ObjectId(companyId) } },
      {
        $lookup: {
          from: 'jobs',
          localField: '_id',
          foreignField: 'company',
          pipeline: [
            {
              $project: {
                jobTitle: 1,
                trade: 1,
                siteAddress: 1,
                status: 1,
                typeOfJob: 1,
                createdAt: 1,
                timelineStartDate: 1,
                timelineEndDate: 1,
              },
            },
            { $sort: { createdAt: -1 } },
          ],
          as: 'jobs',
        },
      },
      {
        $lookup: {
          from: 'invoices',
          let: { companyId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$company', '$$companyId'] },
                paymentStatus: InvoicePaymentStatus.PAID,
              },
            },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
          ],
          as: 'invoiceSummary',
        },
      },
      {
        $addFields: {
          jobsCount: { $size: '$jobs' },
          lifetimeSpend: {
            $ifNull: [{ $arrayElemAt: ['$invoiceSummary.total', 0] }, 0],
          },
        },
      },
      {
        $project: {
          invoiceSummary: 0,
          ...Object.fromEntries(SENSITIVE.map((f) => [f, 0])),
        },
      },
    ]);

    if (!result) {
      throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  async getAdminJobById(jobId: string): Promise<any> {
    const { Types } = require('mongoose');
    const [result] = await this.jobModel.aggregate([
      { $match: { _id: new Types.ObjectId(jobId) } },
      {
        $lookup: {
          from: 'companies',
          localField: 'company',
          foreignField: '_id',
          pipeline: [
            { $project: { companyName: 1, headOfficeAddress: 1, profileImage: 1, workEmail: 1 } },
          ],
          as: 'companyDetails',
        },
      },
      {
        $addFields: {
          company: { $arrayElemAt: ['$companyDetails', 0] },
        },
      },
      { $project: { companyDetails: 0 } },
    ]);

    if (!result) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  // ─── Invoices ────────────────────────────────────────────────────────────────

  async getAllInvoices(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    // Build the aggregation pipeline — join company first so we can filter by name
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'companies',
          localField: 'company',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                companyName: 1,
                workEmail: 1,
                profileImage: 1,
              },
            },
          ],
          as: 'companyDetails',
        },
      },
      {
        $addFields: {
          company: { $arrayElemAt: ['$companyDetails', 0] },
        },
      },
      { $project: { companyDetails: 0 } },
    ];

    // Apply company name search after the lookup
    if (search?.trim()) {
      pipeline.push({
        $match: {
          'company.companyName': { $regex: search.trim(), $options: 'i' },
        },
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const dataPipeline = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          pipeline: [{ $project: { jobTitle: 1, trade: 1, siteAddress: 1 } }],
          as: 'jobDetails',
        },
      },
      { $addFields: { job: { $arrayElemAt: ['$jobDetails', 0] } } },
      { $project: { jobDetails: 0, lineItems: 0 } }, // exclude line items from list view
    ];

    const [countResult, data] = await Promise.all([
      this.invoiceModel.aggregate(countPipeline),
      this.invoiceModel.aggregate(dataPipeline),
    ]);

    const total = countResult[0]?.total ?? 0;

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAdminInvoiceById(invoiceId: string): Promise<any> {
    const invoice = await this.invoiceModel
      .findById(invoiceId)
      .populate('job', 'jobTitle trade siteAddress')
      .populate('company', 'companyName workEmail profileImage headOfficeAddress')
      .populate('lineItems.subcontractor', 'fullName email profileImage')
      .exec();

    if (!invoice) {
      throw new HttpException('Invoice not found', HttpStatus.NOT_FOUND);
    }

    return invoice;
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalCompanies,
      totalSubcontractors,
      activeJobs,
      newJobsToday,
      receiptsPending,
    ] = await Promise.all([
      this.companyModel.countDocuments(),
      this.subcontractorModel.countDocuments(),
      this.jobModel.countDocuments({ status: 'in_progress' }),
      this.jobModel.countDocuments({ createdAt: { $gte: todayStart } }),
      this.invoiceModel.countDocuments({ paymentStatus: InvoicePaymentStatus.UNPAID }),
    ]);

    return {
      totalCompanies,
      totalSubcontractors,
      activeJobs,
      newJobsToday,
      receiptsPending,
    };
  }

  async getPlatformRevenue(months = 6): Promise<{ month: string; revenue: number }[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const raw = await this.invoiceModel.aggregate([
      {
        $match: {
          paymentStatus: InvoicePaymentStatus.PAID,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$totalPlatformFee' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return this.fillMonthlyGaps(since, months, raw, (entry) => ({
      revenue: Math.round(entry?.revenue ?? 0),
    }));
  }

  async getUserGrowthTrend(months = 6): Promise<{
    month: string;
    companies: number;
    subcontractors: number;
    total: number;
  }[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [companyRaw, subcontractorRaw] = await Promise.all([
      this.companyModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      this.subcontractorModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // Build lookup maps keyed by "YYYY-M"
    const companyMap = new Map<string, number>(
      companyRaw.map((e) => [`${e._id.year}-${e._id.month}`, e.count]),
    );
    const subMap = new Map<string, number>(
      subcontractorRaw.map((e) => [`${e._id.year}-${e._id.month}`, e.count]),
    );

    return this.buildMonthRange(since, months).map(({ label, key }) => {
      const companies = companyMap.get(key) ?? 0;
      const subcontractors = subMap.get(key) ?? 0;
      return { month: label, companies, subcontractors, total: companies + subcontractors };
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private buildMonthRange(since: Date, months: number): { label: string; key: string }[] {
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result: { label: string; key: string }[] = [];
    const cursor = new Date(since);

    for (let i = 0; i < months; i++) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1; // 1-indexed
      result.push({ label: `${MONTH_NAMES[m - 1]} ${y}`, key: `${y}-${m}` });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }

  private fillMonthlyGaps<T extends Record<string, any>>(
    since: Date,
    months: number,
    raw: any[],
    pick: (entry: any | undefined) => T,
  ): ({ month: string } & T)[] {
    const map = new Map<string, any>(
      raw.map((e) => [`${e._id.year}-${e._id.month}`, e]),
    );

    return this.buildMonthRange(since, months).map(({ label, key }) => ({
      month: label,
      ...pick(map.get(key)),
    }));
  }
}
