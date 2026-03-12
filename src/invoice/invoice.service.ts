import {
    Injectable,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    Invoice,
    InvoiceDocument,
    InvoiceStatus,
} from './schema/invoice.schema';
import {
    Timesheet,
    TimesheetDocument,
} from '../timesheet/schema/timesheet.schema';
import { Job, JobDocument } from '../job/schema/job.schema';

@Injectable()
export class InvoiceService {
    private readonly logger = new Logger(InvoiceService.name);

    constructor(
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Timesheet.name) private timesheetModel: Model<TimesheetDocument>,
        @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Generate a sequential invoice number like INV-00101.
     */
    private async generateInvoiceNumber(): Promise<string> {
        const count = await this.invoiceModel.countDocuments();
        const paddedNum = String(count + 1).padStart(5, '0');
        return `INV-${paddedNum}`;
    }

    // ─────────────────────────────────────────────────────────────
    // CORE: AUTO-GENERATE INVOICE
    // ─────────────────────────────────────────────────────────────

    /**
     * Auto-generate an invoice for a job + week when all subcontractor timesheets
     * for that week are approved. Called by the scheduler or after a manual approval.
     *
     * Rules:
     * - Only APPROVED timesheets are included
     * - PENDING/DRAFT timesheets are skipped (excluded from invoice per spec)
     * - One invoice per job per week (enforced by unique index)
     */
    async generateInvoiceForWeek(
        jobId: string,
        weekNumber: number,
    ): Promise<InvoiceDocument | null> {
        const jobObjId = new Types.ObjectId(jobId);

        // Check if invoice already exists for this job+week
        const existing = await this.invoiceModel.findOne({
            job: jobObjId,
            weekNumber,
        });
        if (existing) {
            this.logger.log(
                `Invoice already exists for job ${jobId} week ${weekNumber}: ${existing.invoiceNumber}`,
            );
            return existing;
        }

        // Get all approved timesheets for this job + week
        const approvedTimesheets = await this.timesheetModel
            .find({
                job: jobObjId,
                weekNumber,
                status: 'approved',
            })
            .populate('subcontractor', 'fullName email')
            .exec();

        if (approvedTimesheets.length === 0) {
            this.logger.warn(
                `No approved timesheets found for job ${jobId} week ${weekNumber}. Skipping invoice generation.`,
            );
            return null;
        }

        // Fetch the job for metadata
        const job = await this.jobModel.findById(jobObjId);
        if (!job) {
            throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
        }

        // Build line items from approved timesheets
        const lineItems = approvedTimesheets.map((ts) => {
            const sub = ts.subcontractor as any;
            return {
                subcontractor: ts.subcontractor,
                timesheet: ts._id,
                subcontractorName: sub?.fullName || 'Unknown',
                hours: ts.totalHours,
                hourlyRate: ts.hourlyRate,
                grossAmount: ts.grossAmount,
                platformFeePercent: ts.platformFeePercent,
                platformFee: ts.platformFee,
                netPayable: ts.netPayable,
                cisRate: 0,     // CIS: future — set per-worker when implemented
                cisAmount: 0,
            };
        });

        // Aggregate invoice totals
        const subtotal = parseFloat(
            lineItems.reduce((sum, li) => sum + li.grossAmount, 0).toFixed(2),
        );
        const totalPlatformFee = parseFloat(
            lineItems.reduce((sum, li) => sum + li.platformFee, 0).toFixed(2),
        );
        const totalAmount = parseFloat(
            lineItems.reduce((sum, li) => sum + li.netPayable, 0).toFixed(2),
        );

        const invoiceNumber = await this.generateInvoiceNumber();

        // Due date: 30 days from now (configurable for future feature)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const invoice = new this.invoiceModel({
            job: jobObjId,
            company: job.company,
            invoiceNumber,
            weekNumber,
            weekStartDate: approvedTimesheets[0].weekStartDate,
            lineItems,
            subtotal,
            totalPlatformFee,
            totalAmount,
            status: InvoiceStatus.FINALIZED,
            dueDate,
        });

        const saved = await invoice.save();

        this.logger.log(
            `Invoice generated: ${invoiceNumber} for job ${jobId} week ${weekNumber}. Total: £${totalAmount}`,
        );

        return saved;
    }

    /**
     * Check if all submitted timesheets for a job+week are approved,
     * and if so, trigger invoice generation. Called after each approval.
     * Returns the invoice if generated, null otherwise.
     */
    async maybeGenerateInvoice(
        jobId: string,
        weekNumber: number,
    ): Promise<InvoiceDocument | null> {
        // Count any timesheets that are still pending (draft or submitted)
        const stillPending = await this.timesheetModel.countDocuments({
            job: new Types.ObjectId(jobId),
            weekNumber,
            status: { $in: ['draft', 'submitted'] },
        });

        if (stillPending > 0) {
            this.logger.log(
                `Invoice not yet generated for job ${jobId} week ${weekNumber}: ${stillPending} timesheet(s) still pending.`,
            );
            return null;
        }

        return this.generateInvoiceForWeek(jobId, weekNumber);
    }

    // ─────────────────────────────────────────────────────────────
    // COMPANY READ OPERATIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Get all invoices for a specific job (company view).
     */
    async getInvoicesByJob(
        jobId: string,
        companyId: string,
    ): Promise<InvoiceDocument[]> {
        const job = await this.jobModel.findById(jobId);
        if (!job) {
            throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
        }
        if (job.company.toString() !== companyId) {
            throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
        }

        return this.invoiceModel
            .find({ job: new Types.ObjectId(jobId) })
            .populate('job', 'jobTitle trade siteAddress')
            .sort({ weekNumber: 1 })
            .exec();
    }

    /**
     * Get all invoices for a company (across all jobs).
     */
    async getAllInvoicesForCompany(
        companyId: string,
        paymentStatus?: string,
    ): Promise<InvoiceDocument[]> {
        const filter: any = { company: new Types.ObjectId(companyId) };
        if (paymentStatus) filter.paymentStatus = paymentStatus;

        return this.invoiceModel
            .find(filter)
            .populate('job', 'jobTitle trade siteAddress')
            .sort({ createdAt: -1 })
            .exec();
    }

    /**
     * Get a single invoice by ID.
     */
    async getInvoiceById(
        invoiceId: string,
        companyId: string,
    ): Promise<InvoiceDocument> {
        const invoice = await this.invoiceModel
            .findById(invoiceId)
            .populate('job', 'jobTitle trade siteAddress')
            .populate('lineItems.subcontractor', 'fullName email profileImage')
            .exec();

        if (!invoice) {
            throw new HttpException('Invoice not found', HttpStatus.NOT_FOUND);
        }
        if (invoice.company.toString() !== companyId) {
            throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
        }

        return invoice;
    }
}
