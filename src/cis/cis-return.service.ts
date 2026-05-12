import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CisReturn, CisReturnDocument, CisReturnStatus } from './schema/cis-return.schema';
import { Company, CompanyDocument } from '../company/schema/company.schema';

// ── PHASE 2 ──────────────────────────────────────────────────────────────────
// CIS generation, HMRC submission, and retry logic are deferred to next phase.
// Imports for HttpService, HmrcService, Invoice, Subcontractor removed for now.
// Uncomment and restore when HMRC integration is re-enabled.

@Injectable()
export class CisReturnService {
  private readonly logger = new Logger(CisReturnService.name);

  constructor(
    @InjectModel(CisReturn.name) private cisReturnModel: Model<CisReturnDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) { }

  // ─── COMPANY READ ────────────────────────────────────────────────

  async getReturns(companyId: string): Promise<CisReturnDocument[]> {
    return this.cisReturnModel
      .find({ company: new Types.ObjectId(companyId) })
      .sort({ taxYear: -1, taxMonth: -1 })
      .exec();
  }

  async getReturn(returnId: string, companyId: string): Promise<CisReturnDocument> {
    const cisReturn = await this.cisReturnModel
      .findById(returnId)
      .populate('lineItems.subcontractor', 'fullName profileImage')
      .exec();

    if (!cisReturn) throw new HttpException('CIS return not found', HttpStatus.NOT_FOUND);
    if (cisReturn.company.toString() !== companyId) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }

    return cisReturn;
  }

  async markAsPaid(returnId: string, companyId: string): Promise<CisReturnDocument | null> {
    const cisReturn = await this.cisReturnModel.findById(returnId);
    if (!cisReturn) throw new HttpException('CIS return not found', HttpStatus.NOT_FOUND);
    if (cisReturn.company.toString() !== companyId) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }
    if (cisReturn.status !== CisReturnStatus.SUBMITTED) {
      throw new HttpException(
        'Return must be submitted before marking as paid',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.cisReturnModel.findByIdAndUpdate(
      returnId,
      { status: CisReturnStatus.PAID, paidAt: new Date() },
      { new: true },
    );
  }

  // ── PHASE 2 — uncomment when HMRC integration is re-enabled ─────────────

  // async generateForCompany(...) { ... }
  // async submitReturn(...) { ... }
  // async retryFailedSubmissions() { ... }
  // async generateAllReturnsForPreviousPeriod() { ... }
  // private async submitLineItemToHmrc(...) { ... }
}
