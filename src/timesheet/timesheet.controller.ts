import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Request,
    HttpStatus,
    HttpCode,
    Param,
    Query,
} from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { InvoiceService } from '../invoice/invoice.service';
import { LogHoursDto } from './dto/log-hours.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SubcontractorGuard } from '../auth/guards/subcontractor.guard';
import { TimesheetStatus } from './schema/timesheet.schema';

@Controller('timesheets')
export class TimesheetController {
    constructor(
        private readonly timesheetService: TimesheetService,
        private readonly invoiceService: InvoiceService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // SUBCONTRACTOR ENDPOINTS
    // ─────────────────────────────────────────────────────────────

    /**
     * POST /timesheets/log
     * Log or update daily hours for a day on a job.
     * Auto-creates the weekly timesheet if it doesn't exist yet.
     */
    @Post('log')
    @UseGuards(JwtAuthGuard, SubcontractorGuard)
    @HttpCode(HttpStatus.OK)
    async logHours(@Body() dto: LogHoursDto, @Request() req) {
        const timesheet = await this.timesheetService.logHours(dto, req.user.sub);
        return {
            success: true,
            message: 'Hours logged successfully',
            data: timesheet,
        };
    }

    /**
     * POST /timesheets/:id/submit
     * Submit (lock) a weekly timesheet for company approval.
     * Starts the 18-hour review window.
     */
    @Post(':id/submit')
    @UseGuards(JwtAuthGuard, SubcontractorGuard)
    @HttpCode(HttpStatus.OK)
    async submitTimesheet(@Param('id') id: string, @Request() req) {
        const timesheet = await this.timesheetService.submitTimesheet(
            id,
            req.user.sub,
        );
        return {
            success: true,
            message: 'Timesheet submitted. Company has 18 hours to review.',
            data: timesheet,
        };
    }

    /**
     * GET /timesheets/my
     * Get all timesheets for the logged-in subcontractor.
     */
    @Get('my')
    @UseGuards(JwtAuthGuard, SubcontractorGuard)
    async getMyTimesheets(@Request() req) {
        const timesheets = await this.timesheetService.getMyTimesheets(req.user.sub);
        return {
            success: true,
            count: timesheets.length,
            data: timesheets,
        };
    }

    /**
     * GET /timesheets/my/job/:jobId
     * Get all weekly timesheets for a specific job (subcontractor's own view).
     * Optional: ?weekNumber=1  →  returns only that specific week's timesheet.
     */
    @Get('my/job/:jobId')
    @UseGuards(JwtAuthGuard, SubcontractorGuard)
    async getMyTimesheetsByJob(
        @Param('jobId') jobId: string,
        @Query('weekNumber') weekNumber: string,
        @Request() req,
    ) {
        const timesheets = await this.timesheetService.getMyTimesheetsByJob(
            jobId,
            req.user.sub,
            weekNumber ? parseInt(weekNumber, 10) : undefined,
        );
        return {
            success: true,
            count: timesheets.length,
            data: timesheets,
        };
    }

    /**
     * GET /timesheets/:id
     * Get a specific timesheet by ID (subcontractor must be owner).
     */
    @Get(':id')
    @UseGuards(JwtAuthGuard, SubcontractorGuard)
    async getTimesheetById(@Param('id') id: string, @Request() req) {
        const timesheet = await this.timesheetService.getTimesheetById(
            id,
            req.user.sub,
        );
        return {
            success: true,
            data: timesheet,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // COMPANY ENDPOINTS
    // ─────────────────────────────────────────────────────────────

    /**
     * GET /timesheets/company/job/:jobId
     * Get all timesheets for a specific job (company view).
     * Optional query param: ?status=submitted|approved|draft
     */
    @Get('company/job/:jobId')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async getTimesheetsByJob(
        @Param('jobId') jobId: string,
        @Query('status') status: TimesheetStatus,
        @Request() req,
    ) {
        const timesheets = await this.timesheetService.getTimesheetsByJob(
            jobId,
            req.user.sub,
            status,
        );
        return {
            success: true,
            count: timesheets.length,
            data: timesheets,
        };
    }

    /**
     * POST /timesheets/:id/approve
     * Company approves a subcontractor's weekly timesheet.
     * If all timesheets for that job+week are now approved, an invoice is auto-generated.
     */
    @Post(':id/approve')
    @UseGuards(JwtAuthGuard, AdminGuard)
    @HttpCode(HttpStatus.OK)
    async approveTimesheet(@Param('id') id: string, @Request() req) {
        const timesheet = await this.timesheetService.approveTimesheet(
            id,
            req.user.sub,
        );

        // Auto-generate invoice if all timesheets for this job+week are approved
        const invoice = await this.invoiceService.maybeGenerateInvoice(
            timesheet.job.toString(),
            timesheet.weekNumber,
        );

        return {
            success: true,
            message: 'Timesheet approved successfully',
            data: timesheet,
            invoice: invoice ? {
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: invoice.totalAmount,
                status: invoice.status,
                message: 'Invoice auto-generated for this week',
            } : null,
        };
    }
}
