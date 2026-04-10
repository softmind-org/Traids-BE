import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    });
  }

  // ─── COMPANY (CUSTOMER) ────────────────────────────────────────

  async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    return this.stripe.customers.create({ email, name });
  }

  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    return this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async retrievePaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.retrieve(paymentMethodId);
  }

  // ─── SUBCONTRACTOR (EXPRESS CONNECT) ────────────────────────────

  /**
   * Creates a Stripe Express account for a new subcontractor.
   * Called automatically during signup.
   */
  async createExpressAccount(email: string): Promise<Stripe.Account> {
    return this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        transfers: { requested: true },
      },
      settings: {
        payouts: { schedule: { interval: 'manual' } },
      },
    });
  }

  /**
   * Generates a Stripe-hosted onboarding link for a subcontractor
   * to complete their KYC and bank account setup.
   * Call this whenever the subcontractor needs to complete/resume onboarding.
   */
  async createAccountLink(accountId: string): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: process.env.STRIPE_REFRESH_URL!,
      return_url: process.env.STRIPE_RETURN_URL!,
      type: 'account_onboarding',
    });
    return link.url;
  }

  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(accountId);
  }

  // ─── INVOICE PAYMENT ──────────────────────────────────────────

  /**
   * Create a PaymentIntent to charge the company for an invoice.
   * Amount must be in pence (e.g. £12.50 = 1250).
   */
  async createPaymentIntent(
    amountPence: number,
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: amountPence,
      currency: 'gbp',
      customer: customerId,
      payment_method: paymentMethodId,
      payment_method_types: ['card'],
      confirm: true,
      off_session: true,
    });
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
  }

  // ─── SUBCONTRACTOR PAYOUTS (TRANSFERS) ────────────────────────

  /**
   * Transfer funds from platform Stripe account to a connected Standard account.
   * Source transaction ties the transfer to a specific charge (required for Standard).
   */
  async createTransfer(
    amountPence: number,
    destinationAccountId: string,
    sourceTransaction: string,
    description: string,
  ): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create({
      amount: amountPence,
      currency: 'gbp',
      destination: destinationAccountId,
      source_transaction: sourceTransaction,
      description,
    });
  }

  // ─── SUBCONTRACTOR PAYOUT METHOD ─────────────────────────────

  async getExternalAccount(stripeAccountId: string): Promise<Stripe.BankAccount | null> {
    const accounts = await this.stripe.accounts.listExternalAccounts(
      stripeAccountId,
      { object: 'bank_account', limit: 1 },
    );
    if (!accounts.data.length) return null;
    return accounts.data[0] as Stripe.BankAccount;
  }

  // ─── SUBCONTRACTOR MANUAL PAYOUTS ────────────────────────────

  async retrieveBalance(stripeAccountId: string): Promise<Stripe.Balance> {
    return this.stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });
  }

  async createPayout(
    amountPence: number,
    stripeAccountId: string,
  ): Promise<Stripe.Payout> {
    return this.stripe.payouts.create(
      { amount: amountPence, currency: 'gbp' },
      { stripeAccount: stripeAccountId },
    );
  }
}
