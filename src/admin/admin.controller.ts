import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { AdminRole } from './schema/admin.schema';
import { ListQueryDto } from './dto/list-query.dto';
import { UpdateAdminProfileDto } from './dto/update-profile.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * POST /admin/auth/login
   * Public — no guards
   */
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginAdminDto) {
    const result = await this.adminService.loginAdmin(dto);
    return {
      message: 'Login successful',
      accessToken: result.accessToken,
      userType: 'admin',
      user: result.admin,
    };
  }

  /**
   * POST /admin
   * Only SUPER_ADMIN can create new admins
   */
  @Post()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() dto: CreateAdminDto, @Request() req: any) {
    if (req.user.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can create new admin accounts');
    }
    const admin = await this.adminService.createAdmin(dto);
    return {
      message: 'Admin created successfully',
      data: admin,
    };
  }

  /**
   * GET /admin
   * List all admins — SUPER_ADMIN only
   */
  @Get()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getAllAdmins(@Request() req: any) {
    if (req.user.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can view admin accounts');
    }
    const admins = await this.adminService.getAllAdmins();
    return {
      message: 'Admins retrieved successfully',
      count: admins.length,
      data: admins,
    };
  }

  /**
   * GET /admin/me
   * Get own profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getMe(@Request() req: any) {
    const admin = await this.adminService.findById(req.user.sub);
    return {
      message: 'Profile retrieved successfully',
      data: admin,
    };
  }

  /**
   * PATCH /admin/me
   * Update own fullName and/or password
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async updateMe(@Body() dto: UpdateAdminProfileDto, @Request() req: any) {
    const admin = await this.adminService.updateProfile(
      req.user.sub,
      dto.fullName,
      dto.password,
    );
    return {
      message: 'Profile updated successfully',
      data: admin,
    };
  }

  /**
   * GET /admin/subcontractors
   * Paginated list with optional search by name/email
   */
  @Get('subcontractors')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getAllSubcontractors(@Query() query: ListQueryDto) {
    const result = await this.adminService.getAllSubcontractors(
      query.page,
      query.limit,
      query.search,
    );
    return {
      message: 'Subcontractors retrieved successfully',
      ...result,
    };
  }

  /**
   * GET /admin/subcontractors/:id
   * Single subcontractor detail with projects list
   */
  @Get('subcontractors/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getSubcontractorById(@Param('id') id: string) {
    const data = await this.adminService.getSubcontractorById(id);
    return {
      message: 'Subcontractor retrieved successfully',
      data,
    };
  }

  /**
   * GET /admin/companies
   * Paginated company list with jobs count and lifetime spend
   */
  @Get('companies')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getAllCompanies(@Query() query: ListQueryDto) {
    const result = await this.adminService.getAllCompanies(
      query.page,
      query.limit,
      query.search,
    );
    return {
      message: 'Companies retrieved successfully',
      ...result,
    };
  }

  /**
   * GET /admin/companies/:id
   * Company detail + posted jobs by company ID
   */
  @Get('companies/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getCompanyById(@Param('id') id: string) {
    const data = await this.adminService.getCompanyById(id);
    return {
      message: 'Company retrieved successfully',
      data,
    };
  }

  /**
   * GET /admin/jobs/:id
   * Job detail with company info — for the job detail page
   */
  @Get('jobs/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getJobById(@Param('id') id: string) {
    const data = await this.adminService.getAdminJobById(id);
    return {
      message: 'Job retrieved successfully',
      data,
    };
  }

  /**
   * GET /admin/invoices
   * Paginated invoice list with optional search by company name
   */
  @Get('invoices')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getAllInvoices(@Query() query: ListQueryDto) {
    const result = await this.adminService.getAllInvoices(
      query.page,
      query.limit,
      query.search,
    );
    return {
      message: 'Invoices retrieved successfully',
      ...result,
    };
  }

  /**
   * GET /admin/invoices/:id
   * Invoice detail — no ownership check, admin can view any invoice
   */
  @Get('invoices/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getInvoiceById(@Param('id') id: string) {
    const data = await this.adminService.getAdminInvoiceById(id);
    return {
      message: 'Invoice retrieved successfully',
      data,
    };
  }

  /**
   * GET /admin/dashboard
   * Full dashboard data: stats + platform revenue + user growth trend
   */
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async getDashboard() {
    const [stats, platformRevenue, userGrowthTrend] = await Promise.all([
      this.adminService.getDashboardStats(),
      this.adminService.getPlatformRevenue(6),
      this.adminService.getUserGrowthTrend(6),
    ]);

    return {
      message: 'Dashboard data retrieved successfully',
      data: { stats, platformRevenue, userGrowthTrend },
    };
  }

  /**
   * PATCH /admin/:id/toggle-active
   * Activate or deactivate an admin — SUPER_ADMIN only
   */
  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async toggleActive(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can activate/deactivate admin accounts');
    }
    const admin = await this.adminService.toggleActive(id);
    return {
      message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
      data: admin,
    };
  }
}
