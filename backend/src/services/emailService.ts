import nodemailer from 'nodemailer';

export interface SendPaymentEmailOptions {
  recipientEmail: string;
  applicantName: string;
  applicantType: string;
  businessName?: string;
  amount: number;
  currency?: string;
  paymentUrl: string;
  linkId: string;
  purpose: string;
  expiryDays?: number;
  customNote?: string;
}

export class EmailService {
  private static createTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = (process.env.SMTP_USER || 'ficonnectblr@gmail.com').trim();
    const rawPass = (process.env.SMTP_PASS || '').trim();
    const pass = rawPass.replace(/\s+/g, '');

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  static async sendPaymentLinkEmail(options: SendPaymentEmailOptions): Promise<{
    success: boolean;
    simulated: boolean;
    messageId?: string;
    message: string;
  }> {
    const {
      recipientEmail,
      applicantName,
      applicantType,
      businessName,
      amount,
      currency = 'INR',
      paymentUrl,
      linkId,
      purpose,
      expiryDays = 7,
      customNote
    } = options;

    const formattedAmount = `₹${Number(amount).toLocaleString('en-IN')}`;
    const subject = `Payment Request: Complete Your ${applicantType} Onboarding (${formattedAmount})`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 28px 32px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">CONNECT APP</h1>
          <p style="margin: 6px 0 0 0; color: #c7d2fe; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
            Centralized Backoffice • Official Payment Request
          </p>
        </div>

        <div style="padding: 32px 28px;">
          <h2 style="font-size: 18px; color: #ffffff; margin-top: 0; margin-bottom: 8px;">
            Hello ${applicantName},
          </h2>
          <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1; margin-top: 0;">
            Congratulations! Your <strong>${applicantType} KYC Verification</strong> has been reviewed and approved by the Connect App Operations Team.
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1;">
            To complete your registration and activate your dashboard access, please complete the required payment using the secure payment link below.
          </p>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 22px; margin: 24px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #94a3b8;">
              <span>Reference Link ID:</span>
              <strong style="color: #f8fafc; font-family: monospace;">${linkId}</strong>
            </div>
            ${businessName ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #94a3b8;">
              <span>Business / Outlet:</span>
              <strong style="color: #f8fafc;">${businessName}</strong>
            </div>` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #94a3b8;">
              <span>Payment Purpose:</span>
              <strong style="color: #f8fafc;">${purpose}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #94a3b8;">
              <span>Link Expiration:</span>
              <strong style="color: #f59e0b;">Valid for ${expiryDays} Days</strong>
            </div>
            <div style="border-top: 1px dashed #334155; margin-top: 12px; padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 14px; font-weight: bold; color: #e2e8f0;">Total Payable Amount:</span>
              <strong style="font-size: 24px; font-weight: 900; color: #10b981;">${formattedAmount} ${currency}</strong>
            </div>
          </div>

          ${customNote ? `
          <div style="background: #1e1b4b; border: 1px solid #4338ca; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #c7d2fe;">
            <strong>Note from Payment Team:</strong> ${customNote}
          </div>` : ''}

          <div style="text-align: center; margin: 32px 0 24px 0;">
            <a href="${paymentUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
              Complete Payment Now →
            </a>
          </div>

          <p style="font-size: 11px; text-align: center; color: #64748b; margin-top: 8px; word-break: break-all;">
            Or copy and paste this secure link into your browser:<br/>
            <span style="color: #818cf8;">${paymentUrl}</span>
          </p>

          <div style="border-top: 1px solid #1e293b; margin-top: 28px; padding-top: 16px; font-size: 11px; color: #64748b; line-height: 1.5;">
            ⚠️ <strong>Security Notice:</strong> Connect App representatives will never ask for your card CVV, ATM PIN, or UPI MPIN. Complete payments only via the verified payment link above.
            <br/><br/>
            Need assistance? Contact our authorized Support Team at <strong>ficonnectblr@gmail.com</strong>.
          </div>
        </div>

        <div style="background: #020617; padding: 14px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
          This is an automated operational transmission from Forge India Connect Platform.
        </div>
      </div>
    `;

    const rawPass = (process.env.SMTP_PASS || '').trim();
    if (!rawPass) {
      console.log(`[SMTP Mailer Simulated]: Payment link email generated for ${recipientEmail} (Amount: ${formattedAmount}, Link: ${paymentUrl}). Real dispatch skipped because SMTP_PASS is unset.`);
      return {
        success: true,
        simulated: true,
        message: `Payment email recorded & simulated for ${recipientEmail}. Payment link generated successfully.`
      };
    }

    try {
      const transporter = this.createTransporter();
      const info = await transporter.sendMail({
        from: `"Connect App Payment Operations" <${process.env.SMTP_USER || 'ficonnectblr@gmail.com'}>`,
        to: recipientEmail,
        subject,
        html: htmlBody
      });

      console.log(`[SMTP Mailer Success]: Payment link email dispatched to ${recipientEmail}. MessageId: ${info.messageId}`);
      return {
        success: true,
        simulated: false,
        messageId: info.messageId,
        message: `Payment email dispatched successfully to ${recipientEmail}.`
      };
    } catch (err: any) {
      console.error('[SMTP Mailer Error]:', err.message);
      // Fall back gracefully so payment links can still be used directly in app
      return {
        success: true,
        simulated: true,
        message: `Payment link generated, but SMTP delivery failed (${err.message}). Link URL is available for manual delivery.`
      };
    }
  }
}

