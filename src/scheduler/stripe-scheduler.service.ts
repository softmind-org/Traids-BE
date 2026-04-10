import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    Invoice,
    InvoiceDocument,
    InvoiceStatus,
    InvoicePaymentStatus,
} from '../invoice/schema/invoice.schema';
import {
    Subcontractor,
    SubcontractorDocument,
} from '../subcontractor/schema/subcontractor.schema';
import {
    Timesheet,
    TimesheetDocument,
    PaymentStatus,
} from '../timesheet/schema/timesheet.schema';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class StripeSchedulerService {
    private readonly logger = new Logger(StripeSchedulerService.name);

    constructor(
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Subcontractor.name)
        private subcontractorModel: Model<SubcontractorDocument>,
        @InjectModel(Timesheet.name)
        private timesheetModel: Model<TimesheetDocument>,
        private readonly stripeService: StripeService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────
    // CRON 1 — Every 5 minutes: Poll pending invoices for payment success
    // then send transfers to subcontractors
    // ─────────────────────────────────────────────────────────────────────
    @Cron('0 */5 * * * *')
    async pollPaidInvoices(): Promise<void> {
        this.logger.log('Polling pending_payment invoices...');

        const pendingInvoices = await this.invoiceModel.find({
            status: InvoiceStatus.PENDING_PAYMENT,
            stripePaymentIntentId: { $exists: true, $ne: null },
            payoutsProcessed: false,
        });

        if (pendingInvoices.length === 0) return;

        this.logger.log(`Found ${pendingInvoices.length} pending invoice(s) to check.`);

        for (const invoice of pendingInvoices) {
            try {
                const pi = await this.stripeService.retrievePaymentIntent(
                    invoice.stripePaymentIntentId!,
                );

                if (pi.status === 'succeeded') {
                    await this.processSucceededPayment(invoice, pi);
                } else if (pi.status === 'canceled' || pi.status === 'requires_payment_method') {
                    this.logger.warn(
                        `Invoice ${invoice.invoiceNumber} PaymentIntent status: ${pi.status}. Marking as failed.`,
                    );
                    await this.invoiceModel.findByIdAndUpdate(invoice._id, {
                        status: InvoiceStatus.FAILED,
                        paymentStatus: InvoicePaymentStatus.FAILED,
                    });
                }
            } catch (err) {
                this.logger.error(
                    `Error polling invoice ${invoice.invoiceNumber}: ${err.message}`,
                );
            }
        }
    }

    private async processSucceededPayment(
        invoice: InvoiceDocument,
        pi: any,
    ): Promise<void> {
        this.logger.log(
            `Invoice ${invoice.invoiceNumber} payment succeeded. Processing transfers...`,
        );

        // Extract chargeId from the expanded latest_charge
        const chargeId =
            typeof pi.latest_charge === 'string'
                ? pi.latest_charge
                : pi.latest_charge?.id;

        if (!chargeId) {
            this.logger.error(
                `No chargeId found for invoice ${invoice.invoiceNumber}. Cannot create transfers.`,
            );
            return;
        }

        let allTransfersOk = true;

        // Iterate line items and transfer to each subcontractor
        for (let i = 0; i < invoice.lineItems.length; i++) {
            const lineItem = invoice.lineItems[i];
            if (lineItem.paid) continue; // skip already transferred

            try {
                const sub = await this.subcontractorModel.findById(
                    lineItem.subcontractor,
                );

                if (!sub?.stripeAccountId || !sub?.stripeOnboardingComplete) {
                    this.logger.warn(
                        `Subcontractor ${lineItem.subcontractorName} (${lineItem.subcontractor}) does not have a connected Stripe account. Skipping transfer.`,
                    );
                    allTransfersOk = false;
                    continue;
                }

                // Transfer netPayable in pence (already has platform fee deducted)
                const amountPence = Math.round(lineItem.netPayable * 100);

                await this.stripeService.createTransfer(
                    amountPence,
                    sub.stripeAccountId,
                    chargeId,
                    `Invoice ${invoice.invoiceNumber} - Week ${invoice.weekNumber} - ${lineItem.subcontractorName}`,
                );

                // Mark this line item as paid
                await this.invoiceModel.updateOne(
                    { _id: invoice._id },
                    { $set: { [`lineItems.${i}.paid`]: true } },
                );

                this.logger.log(
                    `Transfer of £${lineItem.netPayable} sent to ${lineItem.subcontractorName}`,
                );
            } catch (err) {
                this.logger.error(
                    `Transfer failed for ${lineItem.subcontractorName}: ${err.message}`,
                );
                allTransfersOk = false;
            }
        }

        // Mark invoice as paid only when ALL transfers completed
        if (allTransfersOk) {
            const now = new Date();

            await this.invoiceModel.findByIdAndUpdate(invoice._id, {
                status: InvoiceStatus.PAID,
                paymentStatus: InvoicePaymentStatus.PAID,
                payoutsProcessed: true,
                paidAt: now,
            });

            // Mark all timesheets referenced in the invoice line items as paid
            const timesheetIds = invoice.lineItems.map((li) => li.timesheet);
            await this.timesheetModel.updateMany(
                { _id: { $in: timesheetIds } },
                { paymentStatus: PaymentStatus.PAID, paidAt: now },
            );

            this.logger.log(
                `Invoice ${invoice.invoiceNumber} fully paid and payouts processed. ${timesheetIds.length} timesheet(s) marked as paid.`,
            );
        } else {
            // Some transfers failed — mark payoutsProcessed false so we retry next cycle
            this.logger.warn(
                `Invoice ${invoice.invoiceNumber}: some transfers failed, will retry next cycle.`,
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // CRON 2 — Every 10 minutes: Check subcontractor onboarding status
    // ─────────────────────────────────────────────────────────────────────
    @Cron('0 */10 * * * *')
    async pollSubcontractorOnboarding(): Promise<void> {
        const incomplete = await this.subcontractorModel.find({
            stripeAccountId: { $exists: true, $ne: null },
            stripeOnboardingComplete: false,
        });

        if (incomplete.length === 0) return;

        this.logger.log(
            `Polling onboarding for ${incomplete.length} subcontractor(s)...`,
        );

        for (const sub of incomplete) {
            try {
                const account = await this.stripeService.retrieveAccount(
                    sub.stripeAccountId!,
                );

                if (account.details_submitted && account.charges_enabled) {
                    await this.subcontractorModel.findByIdAndUpdate(sub._id, {
                        stripeOnboardingComplete: true,
                    });
                    this.logger.log(
                        `Subcontractor ${sub.fullName} (${sub._id}) onboarding complete.`,
                    );
                }
            } catch (err) {
                this.logger.error(
                    `Error checking onboarding for subcontractor ${sub._id}: ${err.message}`,
                );
            }
        }
    }
}
