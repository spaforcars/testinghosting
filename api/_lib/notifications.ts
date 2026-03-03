import { Resend } from 'resend';

export interface EnquiryAlertPayload {
  enquiryId: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  serviceType?: string | null;
  sourcePage: string;
  createdAt: string;
}

export const parseDefaultRecipients = (): string[] => {
  const raw = process.env.DEFAULT_ALERT_RECIPIENTS || '';
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const sendEnquiryAlertEmail = async (
  recipients: string[],
  payload: EnquiryAlertPayload
): Promise<{ success: boolean; providerId?: string; error?: string }> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

  if (!apiKey) {
    return { success: false, error: 'Missing RESEND_API_KEY' };
  }
  if (!from) {
    return { success: false, error: 'Missing ALERT_FROM_EMAIL' };
  }
  if (!recipients.length) {
    return { success: false, error: 'No notification recipients configured' };
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to: recipients,
    subject: `New Enquiry: ${payload.serviceType || payload.sourcePage} - ${payload.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 16px 0;color:#111827;">New Enquiry Alert</h2>
        <p style="margin:0 0 12px 0;">A new enquiry/request was submitted on the website.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;font-weight:600;">Name</td><td style="padding:6px 0;">${payload.name}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Email</td><td style="padding:6px 0;">${payload.email}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Phone</td><td style="padding:6px 0;">${payload.phone || '-'}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Source Page</td><td style="padding:6px 0;">${payload.sourcePage}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Service Type</td><td style="padding:6px 0;">${payload.serviceType || '-'}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Submitted At</td><td style="padding:6px 0;">${payload.createdAt}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;">
          <div style="font-weight:600;margin-bottom:6px;">Message</div>
          <div>${payload.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
        <p style="margin-top:20px;">
          <a href="${appUrl}/#/dashboard?enquiry=${payload.enquiryId}" style="background:#f97316;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Open Dashboard</a>
        </p>
      </div>
    `,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, providerId: data?.id };
};

export const getRetryDelayMinutes = (attemptCount: number): number => {
  if (attemptCount <= 1) return 1;
  if (attemptCount === 2) return 5;
  return 30;
};
