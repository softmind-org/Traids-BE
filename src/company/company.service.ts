import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { Company, CompanyDocument } from './schema/company.schema';
import { Job, JobDocument, Status } from '../job/schema/job.schema';
import { Timesheet, TimesheetDocument, TimesheetStatus } from '../timesheet/schema/timesheet.schema';
import { Invoice, InvoiceDocument, InvoicePaymentStatus } from '../invoice/schema/invoice.schema';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/schema/subcontractor.schema';
import { SignUpCompanyDto } from './dto/signup-company.dto';
import { S3UploadService } from '../common/service/s3-upload.service';
import { StripeService } from '../stripe/stripe.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Timesheet.name) private timesheetModel: Model<TimesheetDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
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
    if (updateDto.registrationNumber !== undefined && updateDto.registrationNumber !== company.registrationNumber) {
      throw new HttpException('Registration number cannot be changed after signup', HttpStatus.BAD_REQUEST);
    }
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

  // ─── DASHBOARD STATS ─────────────────────────────────────────────

  async getDashboardStats(companyId: string) {
    const companyObjId = new Types.ObjectId(companyId);
    const now = new Date();

    // Current month boundaries
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Previous month boundaries
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const activeStatuses = [Status.ACCEPTED, Status.IN_PROGRESS];

    // ── 1. Active Jobs ───────────────────────────────────────────
    const activeJobs = await this.jobModel.countDocuments({
      company: companyObjId,
      status: { $in: activeStatuses },
    });

    const prevActiveJobs = await this.jobModel.countDocuments({
      company: companyObjId,
      status: { $in: activeStatuses },
      createdAt: { $lte: prevMonthEnd },
    });

    // ── 2. Subs Booked (unique subcontractors on active jobs) ────
    const activeJobDocs = await this.jobModel
      .find({ company: companyObjId, status: { $in: activeStatuses } })
      .select('assignedTo')
      .lean();

    const subsBooked = new Set(
      activeJobDocs.flatMap((j) => j.assignedTo.map((id) => id.toString())),
    ).size;

    const prevActiveJobDocs = await this.jobModel
      .find({
        company: companyObjId,
        status: { $in: activeStatuses },
        createdAt: { $lte: prevMonthEnd },
      })
      .select('assignedTo')
      .lean();

    const prevSubsBooked = new Set(
      prevActiveJobDocs.flatMap((j) => j.assignedTo.map((id) => id.toString())),
    ).size;

    // ── 3. Pending Approvals (timesheets awaiting approval) ──────
    const pendingApprovals = await this.timesheetModel.countDocuments({
      company: companyObjId,
      status: TimesheetStatus.SUBMITTED,
    });

    const prevPendingApprovals = await this.timesheetModel.countDocuments({
      company: companyObjId,
      status: TimesheetStatus.SUBMITTED,
      submittedAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
    });

    // ── 4. Monthly Spend (paid invoices this month) ──────────────
    const spendAgg = await this.invoiceModel.aggregate([
      {
        $match: {
          company: companyObjId,
          paymentStatus: InvoicePaymentStatus.PAID,
          paidAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const monthlySpend = parseFloat((spendAgg[0]?.total ?? 0).toFixed(2));

    const prevSpendAgg = await this.invoiceModel.aggregate([
      {
        $match: {
          company: companyObjId,
          paymentStatus: InvoicePaymentStatus.PAID,
          paidAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const prevMonthlySpend = parseFloat((prevSpendAgg[0]?.total ?? 0).toFixed(2));

    // ── 5. Active Jobs Trend (Mon–Sun of current week) ───────────
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // shift to Monday
    monday.setHours(0, 0, 0, 0);

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activeJobsTrend = await Promise.all(
      weekDays.map(async (day, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const count = await this.jobModel.countDocuments({
          company: companyObjId,
          status: { $in: activeStatuses },
          timelineStartDate: { $lte: dayEnd },
          timelineEndDate: { $gte: date },
        });

        return { day, date: date.toISOString().split('T')[0], count };
      }),
    );

    // ── 6. Budget Spent — labor only ────────────────────────────
    const laborBudget = monthlySpend; // all spend is labor (no materials/permits yet)

    return {
      activeJobs: {
        current: activeJobs,
        previousMonth: prevActiveJobs,
        change: activeJobs - prevActiveJobs,
      },
      subsBooked: {
        current: subsBooked,
        previousMonth: prevSubsBooked,
        change: subsBooked - prevSubsBooked,
      },
      pendingApprovals: {
        current: pendingApprovals,
        previousMonth: prevPendingApprovals,
        change: pendingApprovals - prevPendingApprovals,
      },
      monthlySpend: {
        current: monthlySpend,
        previousMonth: prevMonthlySpend,
        changePercent:
          prevMonthlySpend === 0
            ? null
            : parseFloat((((monthlySpend - prevMonthlySpend) / prevMonthlySpend) * 100).toFixed(1)),
      },
      activeJobsTrend,
      budgetSpent: {
        labor: laborBudget,
        total: laborBudget,
      },
    };
  }

  // ─── REPORT STATS ─────────────────────────────────────────────────

  async getReportStats(companyId: string) {
    const companyObjId = new Types.ObjectId(companyId);
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ── 1. Monthly Spend — last 6 months (labor only) ────────────────
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const monthlySpendAgg = await this.invoiceModel.aggregate([
      {
        $match: {
          company: companyObjId,
          paymentStatus: InvoicePaymentStatus.PAID,
          paidAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          labor: { $sum: '$totalAmount' },
        },
      },
    ]);

    const monthlySpend: { month: string; year: number; labor: number; materials: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-based
      const found = monthlySpendAgg.find(
        (m) => m._id.year === year && m._id.month === month,
      );
      monthlySpend.push({
        month: monthNames[month - 1],
        year,
        labor: parseFloat((found?.labor ?? 0).toFixed(2)),
        materials: 0,
      });
    }

    // ── 2. Cost Distribution by Trade ────────────────────────────────
    const costDistributionAgg = await this.invoiceModel.aggregate([
      {
        $match: {
          company: companyObjId,
          paymentStatus: InvoicePaymentStatus.PAID,
        },
      },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'jobData',
        },
      },
      { $unwind: '$jobData' },
      {
        $group: {
          _id: '$jobData.trade',
          amount: { $sum: '$totalAmount' },
        },
      },
      { $project: { _id: 0, trade: '$_id', amount: 1 } },
      { $sort: { amount: -1 } },
    ]);

    const totalDistribution = costDistributionAgg.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const costDistribution = costDistributionAgg.map((t) => ({
      trade: t.trade,
      amount: parseFloat(t.amount.toFixed(2)),
      percentage:
        totalDistribution > 0
          ? parseFloat(((t.amount / totalDistribution) * 100).toFixed(1))
          : 0,
    }));

    // ── 3. Project Cost Summary — last 5 jobs ────────────────────────
    const recentJobs = await this.jobModel
      .find({ company: companyObjId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const projectCostSummary = await Promise.all(
      recentJobs.map(async (job) => {
        const spendAgg = await this.invoiceModel.aggregate([
          {
            $match: {
              job: job._id,
              paymentStatus: InvoicePaymentStatus.PAID,
            },
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        return {
          jobId: job._id,
          jobTitle: job.jobTitle,
          trade: job.trade,
          status: job.status,
          spentBudget: parseFloat((spendAgg[0]?.total ?? 0).toFixed(2)),
        };
      }),
    );

    // ── 4. Top 5 Performing Subcontractors by Rating ─────────────────
    // Find all subcontractors who worked on this company's jobs via invoice lineItems
    const subSpendAgg = await this.invoiceModel.aggregate([
      { $match: { company: companyObjId, paymentStatus: InvoicePaymentStatus.PAID } },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: '$lineItems.subcontractor',
          totalSpend: { $sum: '$lineItems.grossAmount' },
          jobIds: { $addToSet: '$job' },
        },
      },
      { $addFields: { jobCount: { $size: '$jobIds' } } },
      {
        $lookup: {
          from: 'subcontractors',
          localField: '_id',
          foreignField: '_id',
          as: 'sub',
        },
      },
      { $unwind: '$sub' },
      {
        $project: {
          _id: 0,
          subcontractorId: '$_id',
          name: '$sub.fullName',
          profileImage: '$sub.profileImage',
          primaryTrade: '$sub.primaryTrade',
          rating: '$sub.averageRating',
          totalRatings: '$sub.totalRatings',
          jobCount: 1,
          totalSpend: { $round: ['$totalSpend', 2] },
        },
      },
      { $sort: { rating: -1, totalSpend: -1 } },
      { $limit: 5 },
    ]);

    return {
      monthlySpend,
      costDistribution,
      projectCostSummary,
      topPerformingSubcontractors: subSpendAgg,
    };
  }
}
