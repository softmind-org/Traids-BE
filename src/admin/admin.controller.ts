import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── ADMIN MANAGEMENT ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() dto: CreateAdminDto) {
    const admin = await this.adminService.createAdmin(dto);
    return { success: true, message: 'Admin created successfully', data: admin };
  }

  @Get()
  async getAllAdmins() {
    const data = await this.adminService.getAllAdmins();
    return { success: true, data };
  }

  // ─── OVERVIEW ─────────────────────────────────────────────────────

  @Get('overview')
  async getOverviewStats() {
    const data = await this.adminService.getOverviewStats();
    return { success: true, data };
  }

  // ─── SUBCONTRACTORS ───────────────────────────────────────────────

  @Get('subcontractors')
  async getAllSubcontractors(@Query('page') page?: string) {
    const result = await this.adminService.getAllSubcontractors(page ? Number(page) : 1);
    return { success: true, ...result };
  }

  @Get('subcontractors/:id')
  async getSubcontractorById(@Param('id') id: string) {
    const data = await this.adminService.getSubcontractorById(id);
    return { success: true, data };
  }

  // ─── COMPANIES ────────────────────────────────────────────────────

  @Get('companies')
  async getAllCompanies(@Query('page') page?: string) {
    const result = await this.adminService.getAllCompanies(page ? Number(page) : 1);
    return { success: true, ...result };
  }

  @Get('companies/:id')
  async getCompanyById(@Param('id') id: string) {
    const data = await this.adminService.getCompanyById(id);
    return { success: true, data };
  }

  // ─── INVOICES ─────────────────────────────────────────────────────

  @Get('invoices')
  async getAllInvoices(@Query('page') page?: string, @Query('paymentStatus') paymentStatus?: string) {
    const result = await this.adminService.getAllInvoices(page ? Number(page) : 1, paymentStatus);
    return { success: true, ...result };
  }

  @Get('invoices/:id')
  async getInvoiceById(@Param('id') id: string) {
    const data = await this.adminService.getInvoiceById(id);
    return { success: true, data };
  }
}
