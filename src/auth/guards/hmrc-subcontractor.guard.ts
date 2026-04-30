import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subcontractor, SubcontractorDocument } from '../../subcontractor/schema/subcontractor.schema';

@Injectable()
export class HmrcSubcontractorGuard implements CanActivate {
  constructor(
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const subcontractorId = request.user?.sub;

    const sub = await this.subcontractorModel
      .findById(subcontractorId)
      .select('hmrcConnected')
      .lean();

    if (!sub?.hmrcConnected) {
      throw new ForbiddenException('Please connect your HMRC account before applying for jobs');
    }

    return true;
  }
}
