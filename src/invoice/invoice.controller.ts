import {
    Controller,
    Get,
    Param,
    UseGuards,
    Request,
    Query,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('invoices')
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    /**
     * GET /invoices
     * Get all invoices for the logged-in company.
     * Optional query: ?paymentStatus=unpaid|processing|paid
     */
    @Get()
    @UseGuards(JwtAuthGuard, AdminGuard)
    async getAllInvoices(
        @Request() req,
        @Query('paymentStatus') paymentStatus?: string,
    ) {
        const invoices = await this.invoiceService.getAllInvoicesForCompany(
            req.user.sub,
            paymentStatus,
        );
        return {
            success: true,
            count: invoices.length,
            data: invoices,
        };
    }

    /**
     * GET /invoices/job/:jobId
     * Get all invoices for a specific job.
     */
    @Get('job/:jobId')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async getInvoicesByJob(@Param('jobId') jobId: string, @Request() req) {
        const invoices = await this.invoiceService.getInvoicesByJob(
            jobId,
            req.user.sub,
        );
        return {
            success: true,
            count: invoices.length,
            data: invoices,
        };
    }

    /**
     * GET /invoices/:id
     * Get a specific invoice by ID with full line-item detail.
     */
    @Get(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async getInvoiceById(@Param('id') id: string, @Request() req) {
        const invoice = await this.invoiceService.getInvoiceById(id, req.user.sub);
        return {
            success: true,
            data: invoice,
        };
    }
}
