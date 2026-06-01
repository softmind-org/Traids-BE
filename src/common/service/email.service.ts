import { Injectable, Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from = process.env.EMAIL_FROM || 'noreply@traids.uk';

  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }

  async sendResetPasswordEmail(email: string, resetCode: string): Promise<void> {
    await sgMail.send({
      to: email,
      from: this.from,
      subject: 'Password Reset Code - Traids',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Use the code below to reset your password:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${resetCode}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <br>
          <p>Best regards,<br>Traids Team</p>
        </div>
      `,
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }

  async sendComplianceEmail(
    recipientEmail: string,
    projectName: string,
    companyName: string,
    files: {
      RAMS: string[];
      permits: string[];
      reports: string[];
      incidents: string[];
      drawings: string[];
    },
  ): Promise<void> {
    const formatFileList = (fileUrls: string[], category: string) => {
      if (!fileUrls || fileUrls.length === 0) {
        return `<p style="color: #666; font-style: italic;">No ${category} files available</p>`;
      }
      return fileUrls.map((url, index) => {
        const fileName = url.split('/').pop() || `${category}-file-${index + 1}`;
        return `
          <div style="margin: 8px 0;">
            <a href="${url}"
               style="color: #2563eb; text-decoration: none; font-weight: 500;"
               target="_blank">
              📎 ${decodeURIComponent(fileName)}
            </a>
          </div>
        `;
      }).join('');
    };

    await sgMail.send({
      to: recipientEmail,
      from: this.from,
      subject: `Compliance Documents - ${projectName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
          <div style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">

            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
                📋 Compliance Documents
              </h1>
            </div>

            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #374151; margin-bottom: 10px;">Dear Recipient,</p>
              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                <strong>${companyName}</strong> has shared compliance documentation for the following project:
              </p>
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1e40af;">${projectName}</p>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <div style="margin-bottom: 25px;">
                <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">📋 RAMS (Risk Assessment Method Statements)</h2>
                ${formatFileList(files.RAMS, 'RAMS')}
              </div>
              <div style="margin-bottom: 25px;">
                <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">📄 Permits</h2>
                ${formatFileList(files.permits, 'Permits')}
              </div>
              <div style="margin-bottom: 25px;">
                <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">📊 Reports</h2>
                ${formatFileList(files.reports, 'Reports')}
              </div>
              <div style="margin-bottom: 25px;">
                <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">⚠️ Incidents</h2>
                ${formatFileList(files.incidents, 'Incidents')}
              </div>
              <div style="margin-bottom: 25px;">
                <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">📐 Drawings</h2>
                ${formatFileList(files.drawings, 'Drawings')}
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
                Best regards,<br>
                <strong>${companyName}</strong><br>
                <em>via Traids Platform</em>
              </p>
            </div>

            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                This email was sent from the Traids Compliance Management System
              </p>
            </div>

          </div>
        </div>
      `,
    });

    this.logger.log(`Compliance email sent to ${recipientEmail} for project ${projectName}`);
  }
}
