import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Company, CompanyDocument } from '../company/schema/company.schema';

@Injectable()
export class HmrcService {
  private readonly logger = new Logger(HmrcService.name);
  private readonly baseUrl = process.env.HMRC_BASE_URL!;
  private readonly clientId = process.env.HMRC_CLIENT_ID!;
  private readonly clientSecret = process.env.HMRC_CLIENT_SECRET!;
  private readonly redirectUri = process.env.HMRC_REDIRECT_URI!;

  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private readonly httpService: HttpService,
  ) { }

  // ─── COMPANY: AUTHORIZATION URL ──────────────────────────────────

  getAuthorizationUrl(companyId: string): string {
    const state = Buffer.from(JSON.stringify({ companyId })).toString('base64');
    const scope = 'write:self-assessment read:self-assessment';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope,
      redirect_uri: this.redirectUri,
      state,
    });

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  // ─── COMPANY: OAUTH CALLBACK ─────────────────────────────────────

  async handleCallback(code: string, state: string): Promise<void> {
    let companyId: string;

    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      companyId = decoded.companyId;
    } catch {
      throw new HttpException('Invalid state parameter', HttpStatus.BAD_REQUEST);
    }

    const tokens = await this.exchangeCodeForTokens(code);
    await this.saveCompanyTokens(companyId, tokens);

    this.logger.log(`HMRC connected for company ${companyId}`);
  }

  // ─── COMPANY: TOKEN EXCHANGE ─────────────────────────────────────

  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/oauth/token`,
          params.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      return response.data;
    } catch (err) {
      this.logger.error(`Token exchange failed: ${err.response?.data?.message || err.message}`);
      throw new HttpException('Failed to connect HMRC account', HttpStatus.BAD_GATEWAY);
    }
  }

  // ─── COMPANY: SAVE TOKENS ────────────────────────────────────────

  private async saveCompanyTokens(
    companyId: string,
    tokens: { access_token: string; refresh_token: string; expires_in: number },
  ): Promise<void> {
    await this.companyModel.findByIdAndUpdate(companyId, {
      hmrcAccessToken: tokens.access_token,
      hmrcRefreshToken: tokens.refresh_token,
      hmrcTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      hmrcConnected: true,
    });
  }

  // ─── COMPANY: REFRESH TOKEN ──────────────────────────────────────

  async refreshCompanyToken(companyId: string): Promise<string> {
    const company = await this.companyModel.findById(companyId);

    if (!company?.hmrcRefreshToken) {
      throw new HttpException('No HMRC refresh token found. Please reconnect HMRC.', HttpStatus.UNAUTHORIZED);
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: company.hmrcRefreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/oauth/token`,
          params.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      const tokens = response.data;
      await this.saveCompanyTokens(companyId, tokens);

      this.logger.log(`HMRC token refreshed for company ${companyId}`);
      return tokens.access_token;
    } catch (err) {
      this.logger.error(`Token refresh failed: ${err.message}`);
      throw new HttpException('Failed to refresh HMRC token. Please reconnect.', HttpStatus.UNAUTHORIZED);
    }
  }

  // ─── COMPANY: GET VALID ACCESS TOKEN ────────────────────────────

  async getValidCompanyToken(companyId: string): Promise<string> {
    const company = await this.companyModel.findById(companyId);

    if (!company?.hmrcAccessToken) {
      throw new HttpException('HMRC account not connected.', HttpStatus.UNAUTHORIZED);
    }

    const now = new Date();
    const expiry = company.hmrcTokenExpiry ? new Date(company.hmrcTokenExpiry) : null;
    const isExpired = !expiry || expiry.getTime() - now.getTime() < 5 * 60 * 1000;

    if (isExpired) {
      return this.refreshCompanyToken(companyId);
    }

    return company.hmrcAccessToken;
  }

  // ─── COMPANY: CONNECTION STATUS ──────────────────────────────────

  async getCompanyConnectionStatus(companyId: string): Promise<{
    connected: boolean;
    tokenExpiry: Date | null;
  }> {
    const company = await this.companyModel
      .findById(companyId)
      .select('hmrcConnected hmrcTokenExpiry');

    if (!company) throw new HttpException('Company not found', HttpStatus.NOT_FOUND);

    return {
      connected: company.hmrcConnected ?? false,
      tokenExpiry: company.hmrcTokenExpiry ?? null,
    };
  }

  // ─── COMPANY: DISCONNECT ─────────────────────────────────────────

  async disconnectCompany(companyId: string): Promise<void> {
    await this.companyModel.findByIdAndUpdate(companyId, {
      hmrcConnected: false,
      hmrcAccessToken: null,
      hmrcRefreshToken: null,
      hmrcTokenExpiry: null,
    });
  }
}
