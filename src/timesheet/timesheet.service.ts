import {
    Injectable,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    Timesheet,
    TimesheetDocument,
    TimesheetStatus,
    DailyLog,
} from './schema/timesheet.schema';
import { Job, JobDocument } from '../job/schema/job.schema';
import {
    JobApplication,
    JobApplicationDocument,
} from '../job-application/schema/job-application.schema';
import {
    Offer,
    OfferDocument,
} from '../offer/schema/offer.schema';
import { LogHoursDto } from './dto/log-hours.dto';

@Injectable()
export class TimesheetService {
    private readonly logger = new Logger(TimesheetService.name);
    private readonly PLATFORM_FEE_PERCENT = 0.1; // 10%
    private readonly REVIEW_WINDOW_HOURS = 18;

    constructor(
        @InjectModel(Timesheet.name) private timesheetModel: Model<TimesheetDocument>,
        @InjectModel(Job.name) private jobModel: Model<JobDocument>,
        @InjectModel(JobApplication.name) private applicationModel: Model<JobApplicationDocument>,
        @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Parse a time string like "08:00 AM" into total minutes from midnight.
     */
    private parseTimeToMinutes(timeStr: string): number {
        const [timePart, period] = timeStr.split(' ');
        const [hourStr, minuteStr] = timePart.split(':');
        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr, 10);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }

    /**
     * Calculate hours worked between checkIn and checkOut strings.
     */
    private calculateHours(checkIn: string, checkOut: string): number {
        const inMinutes = this.parseTimeToMinutes(checkIn);
        const outMinutes = this.parseTimeToMinutes(checkOut);
        if (outMinutes <= inMinutes) {
            throw new HttpException(
                'Check-out time must be after check-in time',
                HttpStatus.BAD_REQUEST,
            );
        }
        return parseFloat(((outMinutes - inMinutes) / 60).toFixed(2));
    }

    /**
     * Compute which week number (1-based, relative to job start) a given date falls into.
     * Week boundaries are based on job's timelineStartDate, each week is 7 days.
     */
    private getWeekNumber(jobStartDate: Date, targetDate: Date): number {
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysDiff = Math.floor(
            (targetDate.getTime() - jobStartDate.getTime()) / msPerDay,
        );
        if (daysDiff < 0) {
            throw new HttpException(
                'Date is before the job start date',
                HttpStatus.BAD_REQUEST,
            );
        }
        return Math.floor(daysDiff / 7) + 1;
    }

    /**
     * Get the Monday-like start of the week for a given date relative to job start.
     * Week 1 starts on job start date, each next week starts 7 days later.
     */
    private getWeekStartDate(jobStartDate: Date, weekNumber: number): Date {
        const weekStart = new Date(jobStartDate);
        weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
    }

    /**
     * Determine the hourly rate for a subcontractor on a job.
     * Priority: JobApplication.proposedDailyRate → Offer → Job.hourlyRate
     */
    private async resolveHourlyRate(
        jobId: Types.ObjectId,
        subcontractorId: Types.ObjectId,
        jobHourlyRate: number,
    ): Promise<number> {
        // Check job application first
        const application = await this.applicationModel.findOne({
            job: jobId,
            subcontractor: subcontractorId,
        });
        if (application?.proposedDailyRate) {
            return application.proposedDailyRate;
        }

        // Check accepted offer
        const offer = await this.offerModel.findOne({
            job: jobId,
            subcontractor: subcontractorId,
            status: 'accepted',
        });
        if (offer) {
            // Offer doesn't carry a rate in current schema, fall through to job rate
        }

        return jobHourlyRate;
    }

    /**
     * Recalculate financial totals on a timesheet and save.
     */
    private recalculateTotals(timesheet: TimesheetDocument): void {
        const totalHours = timesheet.dailyLogs.reduce(
            (sum, log) => sum + log.hoursWorked,
            0,
        );
        const grossAmount = parseFloat((totalHours * timesheet.hourlyRate).toFixed(2));
        const platformFee = parseFloat((grossAmount * timesheet.platformFeePercent).toFixed(2));
        const netPayable = parseFloat((grossAmount - platformFee).toFixed(2));

        timesheet.totalHours = parseFloat(totalHours.toFixed(2));
        timesheet.grossAmount = grossAmount;
        timesheet.platformFee = platformFee;
        timesheet.netPayable = netPayable;
    }

    // ─────────────────────────────────────────────────────────────
    // SUBCONTRACTOR OPERATIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Log or update daily hours for a subcontractor on a job.
     * Auto-creates the timesheet for the appropriate week if it doesn't exist.
     * Throws if the timesheet for that week is already submitted.
     */
    async logHours(
        dto: LogHoursDto,
        subcontractorId: string,
    ): Promise<TimesheetDocument> {
        const job = await this.jobModel.findById(dto.jobId);
        if (!job) {
            throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
        }

        // Guard: only allowed when job is in_progress
        if (job.status !== 'in_progress') {
            throw new HttpException(
                'Timesheets can only be logged for jobs that are in progress',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Guard: subcontractor must be assigned to this job
        const subObjId = new Types.ObjectId(subcontractorId);
        const isAssigned = job.assignedTo.some(
            (id) => id.toString() === subcontractorId,
        );
        if (!isAssigned) {
            throw new HttpException(
                'You are not assigned to this job',
                HttpStatus.FORBIDDEN,
            );
        }

        const targetDate = new Date(dto.date);
        targetDate.setHours(0, 0, 0, 0);

        const weekNumber = this.getWeekNumber(job.timelineStartDate, targetDate);
        const weekStartDate = this.getWeekStartDate(job.timelineStartDate, weekNumber);

        // Find or create the timesheet for this week
        let timesheet = await this.timesheetModel.findOne({
            job: new Types.ObjectId(dto.jobId),
            subcontractor: subObjId,
            weekNumber,
        });

        if (timesheet) {
            // Guard: cannot edit submitted/approved timesheets
            if (timesheet.status !== TimesheetStatus.DRAFT) {
                throw new HttpException(
                    'This week\'s timesheet has already been submitted and cannot be modified',
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            // Resolve the hourly rate for this subcontractor
            const hourlyRate = await this.resolveHourlyRate(
                new Types.ObjectId(dto.jobId),
                subObjId,
                job.hourlyRate,
            );

            timesheet = new this.timesheetModel({
                job: new Types.ObjectId(dto.jobId),
                subcontractor: subObjId,
                company: job.company,
                weekStartDate,
                weekNumber,
                hourlyRate,
                platformFeePercent: this.PLATFORM_FEE_PERCENT,
                status: TimesheetStatus.DRAFT,
                dailyLogs: [],
            });
        }

        // Calculate hours worked
        const hoursWorked = this.calculateHours(dto.checkIn, dto.checkOut);

        // Check if there's already a log for this date
        const existingLogIndex = timesheet.dailyLogs.findIndex(
            (log) =>
                new Date(log.date).toDateString() === targetDate.toDateString(),
        );

        const newLog: DailyLog = {
            date: targetDate,
            checkIn: dto.checkIn,
            checkOut: dto.checkOut,
            hoursWorked,
            isLocked: false,
        };

        if (existingLogIndex >= 0) {
            timesheet.dailyLogs[existingLogIndex] = newLog;
        } else {
            timesheet.dailyLogs.push(newLog);
        }

        // Sort daily logs by date
        timesheet.dailyLogs.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

        // Recalculate totals
        this.recalculateTotals(timesheet);

        return timesheet.save();
    }

    /**
     * Submit (lock) the weekly timesheet for approval.
     * Sets status to SUBMITTED, locks all daily logs, and sets review window expiry.
     */
    async submitTimesheet(
        timesheetId: string,
        subcontractorId: string,
    ): Promise<TimesheetDocument> {
        const timesheet = await this.timesheetModel.findById(timesheetId);

        if (!timesheet) {
            throw new HttpException('Timesheet not found', HttpStatus.NOT_FOUND);
        }

        if (timesheet.subcontractor.toString() !== subcontractorId) {
            throw new HttpException(
                'You do not have permission to submit this timesheet',
                HttpStatus.FORBIDDEN,
            );
        }

        if (timesheet.status !== TimesheetStatus.DRAFT) {
            throw new HttpException(
                'Only draft timesheets can be submitted',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (timesheet.dailyLogs.length === 0) {
            throw new HttpException(
                'Cannot submit an empty timesheet — log at least one day',
                HttpStatus.BAD_REQUEST,
            );
        }

        const now = new Date();
        const reviewExpiry = new Date(now);
        reviewExpiry.setHours(reviewExpiry.getHours() + this.REVIEW_WINDOW_HOURS);

        // Lock all daily logs
        timesheet.dailyLogs.forEach((log) => {
            log.isLocked = true;
        });

        timesheet.status = TimesheetStatus.SUBMITTED;
        timesheet.submittedAt = now;
        timesheet.reviewWindowExpiry = reviewExpiry;

        // Recalculate final totals
        this.recalculateTotals(timesheet);

        this.logger.log(
            `Timesheet submitted: ${timesheetId} by subcontractor ${subcontractorId}. Review window expires: ${reviewExpiry.toISOString()}`,
        );

        return timesheet.save();
    }

    /**
     * Get all timesheets for the logged-in subcontractor, grouped by job.
     */
    async getMyTimesheets(subcontractorId: string): Promise<TimesheetDocument[]> {
        return this.timesheetModel
            .find({ subcontractor: new Types.ObjectId(subcontractorId) })
            .populate('job', 'jobTitle trade siteAddress timelineStartDate')
            .populate('company', 'companyName')
            .sort({ weekNumber: -1, createdAt: -1 })
            .exec();
    }

    /**
     * Get timesheets for a specific job (subcontractor's own view).
     */
    async getMyTimesheetsByJob(
        jobId: string,
        subcontractorId: string,
    ): Promise<TimesheetDocument[]> {
        return this.timesheetModel
            .find({
                job: new Types.ObjectId(jobId),
                subcontractor: new Types.ObjectId(subcontractorId),
            })
            .populate('job', 'jobTitle trade siteAddress')
            .sort({ weekNumber: 1 })
            .exec();
    }

    /**
     * Get a single timesheet by ID (only accessible by the owning subcontractor).
     */
    async getTimesheetById(
        timesheetId: string,
        subcontractorId: string,
    ): Promise<TimesheetDocument> {
        const timesheet = await this.timesheetModel
            .findById(timesheetId)
            .populate('job', 'jobTitle trade siteAddress timelineStartDate hourlyRate')
            .populate('company', 'companyName')
            .exec();

        if (!timesheet) {
            throw new HttpException('Timesheet not found', HttpStatus.NOT_FOUND);
        }

        if (timesheet.subcontractor.toString() !== subcontractorId) {
            throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
        }

        return timesheet;
    }

    // ─────────────────────────────────────────────────────────────
    // COMPANY OPERATIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Get all timesheets for a specific job (company view).
     * Grouped by worker, filterable by status.
     */
    async getTimesheetsByJob(
        jobId: string,
        companyId: string,
        status?: TimesheetStatus,
    ): Promise<TimesheetDocument[]> {
        const job = await this.jobModel.findById(jobId);
        if (!job) {
            throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
        }

        if (job.company.toString() !== companyId) {
            throw new HttpException(
                'You do not have permission to view this job\'s timesheets',
                HttpStatus.FORBIDDEN,
            );
        }

        const filter: any = { job: new Types.ObjectId(jobId) };
        if (status) filter.status = status;

        return this.timesheetModel
            .find(filter)
            .populate('subcontractor', 'fullName email profileImage primaryTrade')
            .sort({ weekNumber: 1, submittedAt: 1 })
            .exec();
    }

    /**
     * Company approves a specific subcontractor's weekly timesheet.
     * After approval, triggers a check to auto-generate an invoice if all are approved.
     */
    async approveTimesheet(
        timesheetId: string,
        companyId: string,
    ): Promise<TimesheetDocument> {
        const timesheet = await this.timesheetModel.findById(timesheetId);

        if (!timesheet) {
            throw new HttpException('Timesheet not found', HttpStatus.NOT_FOUND);
        }

        if (timesheet.company.toString() !== companyId) {
            throw new HttpException(
                'You do not have permission to approve this timesheet',
                HttpStatus.FORBIDDEN,
            );
        }

        if (timesheet.status !== TimesheetStatus.SUBMITTED) {
            throw new HttpException(
                `Cannot approve timesheet with status: ${timesheet.status}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        timesheet.status = TimesheetStatus.APPROVED;
        timesheet.approvedAt = new Date();

        await timesheet.save();

        this.logger.log(
            `Timesheet approved: ${timesheetId} for job ${timesheet.job} week ${timesheet.weekNumber}`,
        );

        return timesheet;
    }

    // ─────────────────────────────────────────────────────────────
    // SCHEDULER OPERATIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Called by the scheduler every hour.
     * Auto-approves submitted timesheets whose 18-hour review window has expired.
     * Returns list of timesheets that were auto-approved (for invoice generation).
     */
    async autoApproveExpiredTimesheets(): Promise<TimesheetDocument[]> {
        const now = new Date();

        const expired = await this.timesheetModel.find({
            status: TimesheetStatus.SUBMITTED,
            reviewWindowExpiry: { $lte: now },
        });

        if (expired.length === 0) return [];

        const autoApproved: TimesheetDocument[] = [];

        for (const timesheet of expired) {
            timesheet.status = TimesheetStatus.APPROVED;
            timesheet.approvedAt = now;
            await timesheet.save();
            autoApproved.push(timesheet);
            this.logger.log(
                `Auto-approved timesheet ${timesheet._id} for job ${timesheet.job} week ${timesheet.weekNumber}`,
            );
        }

        return autoApproved;
    }

    /**
     * Check if all submitted timesheets for a job+week are approved.
     * Used by InvoiceService to decide whether to generate an invoice.
     */
    async areAllTimesheetsApprovedForWeek(
        jobId: string,
        weekNumber: number,
    ): Promise<boolean> {
        const pending = await this.timesheetModel.countDocuments({
            job: new Types.ObjectId(jobId),
            weekNumber,
            status: { $in: [TimesheetStatus.DRAFT, TimesheetStatus.SUBMITTED] },
        });
        return pending === 0;
    }

    /**
     * Get all approved timesheets for a job and week (for invoice line items).
     */
    async getApprovedTimesheetsForWeek(
        jobId: string,
        weekNumber: number,
    ): Promise<TimesheetDocument[]> {
        return this.timesheetModel
            .find({
                job: new Types.ObjectId(jobId),
                weekNumber,
                status: TimesheetStatus.APPROVED,
            })
            .populate('subcontractor', 'fullName email')
            .exec();
    }
}
