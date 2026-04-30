import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CisReturn, CisReturnDocument, CisReturnLineItem, CisReturnStatus } from './schema/cis-return.schema';
import { Invoice, InvoiceDocument, InvoicePaymentStatus } from '../invoice/schema/invoice.schema';
import { Company, CompanyDocument } from '../company/schema/company.schema';
import { Subcontractor, SubcontractorDocument } from '../subcontractor/schema/subcontractor.schema';
import { HmrcService } from '../hmrc/hmrc.service';

@Injectable()
export class CisReturnService {
  private readonly logger = new Logger(CisReturnService.name);
  private readonly hmrcBaseUrl = process.env.HMRC_BASE_URL!;

  constructor(
    @InjectModel(CisReturn.name) private cisReturnModel: Model<CisReturnDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Subcontractor.name) private subcontractorModel: Model<SubcontractorDocument>,
    private readonly httpService: HttpService,
    private readonly hmrcService: HmrcService,
  ) { }

  // ─── HELPERS ────────────────────────────────────────────────────

  private getCisTaxPeriod(date: Date): { taxYear: string; taxMonth: number } {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const cisMonth = day >= 6 ? month : month - 1 === 0 ? 12 : month - 1;
    const cisYear = cisMonth >= 4 ? year : year - 1;
    const taxYear = `${cisYear}-${String(cisYear + 1).slice(2)}`;
    const taxMonth = cisMonth >= 4 ? cisMonth - 3 : cisMonth + 9;

    return { taxYear, taxMonth };
  }

  getPreviousCisPeriod(): { periodStart: Date; periodEnd: Date; taxYear: string; taxMonth: number } {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { taxYear, taxMonth } = this.getCisTaxPeriod(periodStart);
    return { periodStart, periodEnd, taxYear, taxMonth };
  }

  private getDueDate(periodEnd: Date): Date {
    return new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 19);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // ─── HMRC LINE ITEM SUBMISSION ───────────────────────────────────

  /**
   * Submits a single line item to HMRC using the subcontractor's own OAuth token.
   * Returns success + submissionId, or failure + error message.
   */
  private async submitLineItemToHmrc(
    lineItem: CisReturnLineItem,
    cisReturn: CisReturnDocument,
    company: CompanyDocument,
  ): Promise<{ success: boolean; submissionId?: string; error?: string; skipped?: boolean }> {
    const subcontractorId = lineItem.subcontractor.toString();

    const sub = await this.subcontractorModel
      .findById(subcontractorId)
      .select('nino hmrcConnected')
      .lean();

    if (!sub?.nino) {
      return { success: false, skipped: true, error: 'No NINO on file' };
    }

    if (!sub.hmrcConnected) {
      return { success: false, skipped: true, error: 'Subcontractor not connected to HMRC' };
    }

    try {
      const token = await this.hmrcService.getValidSubcontractorToken(subcontractorId);

      // Tax year boundaries derived from taxYear field (e.g. "2025-26")
      const startYear = parseInt(cisReturn.taxYear.split('-')[0], 10);
      const fromDate = `${startYear}-04-06`;
      const toDate = `${startYear + 1}-04-05`;

      const body = {
        fromDate,
        toDate,
        contractorName: company.companyName,
        // employerRef: company.employerReference || '',
        employerRef: "123/AB56797",
        periodData: [
          {
            deductionFromDate: this.formatDate(cisReturn.periodStart),
            deductionToDate: this.formatDate(cisReturn.periodEnd),
            grossAmountPaid: lineItem.grossPaid,
            deductionAmount: lineItem.cisDeduction,
            costOfMaterials: 0,
          },
        ],
      };

      console.log(body, "body");
      console.log(this.hmrcBaseUrl, "base url");
      console.log(token, "token");

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.hmrcBaseUrl}/individuals/deductions/cis/${sub.nino}/amendments`,
          body,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.hmrc.3.0+json',
            },
          },
        ),
      );
      console.log(response, "response");

      return { success: true, submissionId: response.data.submissionId };
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.code || err.message;
      this.logger.error(`HMRC submission failed for ${lineItem.subcontractorName}: ${message}`);
      return { success: false, error: message };
    }
  }

  // ─── GENERATE RETURN ────────────────────────────────────────────

  async generateForCompany(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<CisReturnDocument | null> {
    const { taxYear, taxMonth } = this.getCisTaxPeriod(periodStart);
    const companyObjId = new Types.ObjectId(companyId);

    const existing = await this.cisReturnModel.findOne({
      company: companyObjId,
      taxYear,
      taxMonth,
    });
    if (existing && existing.status !== CisReturnStatus.DRAFT) {
      this.logger.log(
        `CIS return for company ${companyId} ${taxYear} M${taxMonth} already ${existing.status} — skipping`,
      );
      return existing;
    }

    const invoices = await this.invoiceModel.find({
      company: companyObjId,
      paymentStatus: InvoicePaymentStatus.PAID,
      paidAt: { $gte: periodStart, $lte: periodEnd },
    }).exec();

    if (invoices.length === 0) {
      this.logger.log(
        `No paid invoices for company ${companyId} in period ${periodStart.toDateString()}–${periodEnd.toDateString()}`,
      );
      return null;
    }

    const subMap = new Map<string, {
      subcontractorId: Types.ObjectId;
      subcontractorName: string;
      subcontractorUtr: string;
      grossPaid: number;
      cisDeduction: number;
      netPaid: number;
    }>();

    for (const invoice of invoices) {
      for (const li of invoice.lineItems) {
        if (!li.paid) continue;
        const subId = li.subcontractor.toString();
        const existing = subMap.get(subId);
        if (existing) {
          existing.grossPaid += li.grossAmount;
          existing.cisDeduction += li.cisDeduction;
          existing.netPaid += li.netPayable;
        } else {
          subMap.set(subId, {
            subcontractorId: li.subcontractor,
            subcontractorName: li.subcontractorName,
            subcontractorUtr: '',
            grossPaid: li.grossAmount,
            cisDeduction: li.cisDeduction,
            netPaid: li.netPayable,
          });
        }
      }
    }

    if (subMap.size === 0) return null;

    // Populate UTR from subcontractor documents
    const subIds = Array.from(subMap.keys());
    const subcontractors = await this.subcontractorModel
      .find({ _id: { $in: subIds } })
      .select('_id utr')
      .lean();

    for (const sub of subcontractors) {
      const entry = subMap.get(sub._id.toString());
      if (entry && sub.utr) entry.subcontractorUtr = sub.utr;
    }

    const lineItems = Array.from(subMap.values()).map((s) => ({
      subcontractor: s.subcontractorId,
      subcontractorName: s.subcontractorName,
      subcontractorUtr: s.subcontractorUtr,
      grossPaid: parseFloat(s.grossPaid.toFixed(2)),
      cisDeduction: parseFloat(s.cisDeduction.toFixed(2)),
      netPaid: parseFloat(s.netPaid.toFixed(2)),
    }));

    const totalGross = parseFloat(lineItems.reduce((s, l) => s + l.grossPaid, 0).toFixed(2));
    const totalCisDeduction = parseFloat(lineItems.reduce((s, l) => s + l.cisDeduction, 0).toFixed(2));
    const totalNet = parseFloat(lineItems.reduce((s, l) => s + l.netPaid, 0).toFixed(2));
    const dueDate = this.getDueDate(periodEnd);

    const returnData = {
      company: companyObjId,
      taxYear,
      taxMonth,
      periodStart,
      periodEnd,
      dueDate,
      lineItems,
      totalGross,
      totalCisDeduction,
      totalNet,
      status: CisReturnStatus.DRAFT,
    };

    let cisReturn: CisReturnDocument;
    if (existing) {
      Object.assign(existing, returnData);
      cisReturn = await existing.save();
    } else {
      cisReturn = await this.cisReturnModel.create(returnData);
    }

    this.logger.log(
      `CIS return generated for company ${companyId}: ${taxYear} M${taxMonth}, total CIS £${totalCisDeduction}`,
    );

    return cisReturn;
  }

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
      .populate('lineItems.subcontractor', 'fullName utr profileImage')
      .exec();

    if (!cisReturn) throw new HttpException('CIS return not found', HttpStatus.NOT_FOUND);
    if (cisReturn.company.toString() !== companyId) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }

    return cisReturn;
  }

  // ─── SUBMIT ─────────────────────────────────────────────────────

  /**
   * Submits each line item to HMRC using the subcontractor's own OAuth token.
   * Skipped = no NINO or not HMRC connected (retried daily by cron).
   * Failed = HMRC API error (retried daily by cron).
   * The overall CIS return is marked submitted regardless of line item outcomes.
   */
  async submitReturn(returnId: string, companyId: string): Promise<{
    totalCisDeduction: number;
    dueDate: Date;
    taxYear: string;
    taxMonth: number;
    submitted: number;
    failed: number;
    skipped: number;
    message: string;
  }> {
    const cisReturn = await this.cisReturnModel.findById(returnId);
    if (!cisReturn) throw new HttpException('CIS return not found', HttpStatus.NOT_FOUND);
    if (cisReturn.company.toString() !== companyId) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }
    if (cisReturn.status === CisReturnStatus.PAID) {
      throw new HttpException('This return has already been paid', HttpStatus.BAD_REQUEST);
    }

    const company = await this.companyModel.findById(companyId);
    if (!company) throw new HttpException('Company not found', HttpStatus.NOT_FOUND);

    let submittedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < cisReturn.lineItems.length; i++) {
      const lineItem = cisReturn.lineItems[i];

      // Skip line items already successfully submitted
      if (lineItem.submissionStatus === 'submitted') {
        submittedCount++;
        continue;
      }

      const result = await this.submitLineItemToHmrc(lineItem, cisReturn, company);

      if (result.success) {
        cisReturn.lineItems[i].submissionStatus = 'submitted';
        cisReturn.lineItems[i].hmrcSubmissionId = result.submissionId;
        cisReturn.lineItems[i].submissionError = undefined;
        submittedCount++;
      } else if (result.skipped) {
        cisReturn.lineItems[i].submissionStatus = 'skipped';
        cisReturn.lineItems[i].submissionError = result.error;
        skippedCount++;
      } else {
        cisReturn.lineItems[i].submissionStatus = 'failed';
        cisReturn.lineItems[i].submissionError = result.error;
        failedCount++;
      }
    }

    cisReturn.status = CisReturnStatus.SUBMITTED;
    cisReturn.submittedAt = new Date();
    await cisReturn.save();

    this.logger.log(
      `CIS return ${returnId} submitted — ✓ ${submittedCount} succeeded, ✗ ${failedCount} failed, ⊘ ${skippedCount} skipped`,
    );

    return {
      totalCisDeduction: cisReturn.totalCisDeduction,
      dueDate: cisReturn.dueDate,
      taxYear: cisReturn.taxYear,
      taxMonth: cisReturn.taxMonth,
      submitted: submittedCount,
      failed: failedCount,
      skipped: skippedCount,
      message: `Please pay £${cisReturn.totalCisDeduction.toFixed(2)} to HMRC by ${cisReturn.dueDate.toDateString()}`,
    };
  }

  // ─── RETRY FAILED/SKIPPED ────────────────────────────────────────

  /**
   * Called by the daily cron at 9am.
   * Finds all submitted CIS returns with failed or skipped line items and retries them.
   */
  async retryFailedSubmissions(): Promise<void> {
    const returns = await this.cisReturnModel.find({
      status: CisReturnStatus.SUBMITTED,
      'lineItems.submissionStatus': { $in: ['failed', 'skipped'] },
    });

    if (returns.length === 0) {
      this.logger.log('CIS retry: no failed/skipped line items found');
      return;
    }

    this.logger.log(`CIS retry: processing ${returns.length} return(s) with failed/skipped line items`);

    for (const cisReturn of returns) {
      const company = await this.companyModel.findById(cisReturn.company);
      if (!company) continue;
      let updated = false;

      for (let i = 0; i < cisReturn.lineItems.length; i++) {
        const lineItem = cisReturn.lineItems[i];
        if (lineItem.submissionStatus !== 'failed' && lineItem.submissionStatus !== 'skipped') continue;

        const result = await this.submitLineItemToHmrc(lineItem, cisReturn, company);

        if (result.success) {
          cisReturn.lineItems[i].submissionStatus = 'submitted';
          cisReturn.lineItems[i].hmrcSubmissionId = result.submissionId;
          cisReturn.lineItems[i].submissionError = undefined;
          this.logger.log(`CIS retry: ✓ ${lineItem.subcontractorName} submitted successfully`);
        } else {
          cisReturn.lineItems[i].submissionStatus = result.skipped ? 'skipped' : 'failed';
          cisReturn.lineItems[i].submissionError = result.error;
          this.logger.warn(`CIS retry: ✗ ${lineItem.subcontractorName} — ${result.error}`);
        }

        updated = true;
      }

      if (updated) await cisReturn.save();
    }

    this.logger.log('CIS retry: complete');
  }

  // ─── MARK AS PAID ────────────────────────────────────────────────

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

  // ─── SCHEDULER ENTRY POINT ──────────────────────────────────────

  async generateAllReturnsForPreviousPeriod(): Promise<void> {
    const { periodStart, periodEnd } = this.getPreviousCisPeriod();

    const companies = await this.companyModel.find().select('_id').lean();

    this.logger.log(
      `Generating CIS returns for period ${periodStart.toDateString()}–${periodEnd.toDateString()} ` +
      `for ${companies.length} companies`,
    );

    for (const company of companies) {
      try {
        await this.generateForCompany(company._id.toString(), periodStart, periodEnd);
      } catch (err) {
        this.logger.error(`Failed to generate CIS return for company ${company._id}: ${err.message}`);
      }
    }
  }
}
