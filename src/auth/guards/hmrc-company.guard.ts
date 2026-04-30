import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../../company/schema/company.schema';

@Injectable()
export class HmrcCompanyGuard implements CanActivate {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.user?.sub;

    const company = await this.companyModel
      .findById(companyId)
      .select('hmrcConnected')
      .lean();

    if (!company?.hmrcConnected) {
      throw new ForbiddenException('Please connect your HMRC account before posting jobs');
    }

    return true;
  }
}
