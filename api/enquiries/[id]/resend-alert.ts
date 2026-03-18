import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../_lib/auth';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../_lib/http';
import { parseDefaultRecipients, sendEnquiryAlertEmail } from '../../_lib/notifications';
import { writeAuditLog } from '../../_lib/audit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'notifications', 'write')) return forbidden(res);

    const enquiryId = readRouteId(req, 1);
    if (!enquiryId) return res.status(400).json({ error: 'Missing enquiry id' });

    const { data: enquiry } = await supabase
      .from('enquiries')
      .select('*')
      .eq('id', enquiryId)
      .maybeSingle();

    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });

    const recipientRows = await supabase
      .from('admin_notification_recipients')
      .select('email')
      .eq('enabled', true);

    const recipients = recipientRows.data?.length
      ? recipientRows.data.map((row) => row.email)
      : parseDefaultRecipients();

    const result = await sendEnquiryAlertEmail(recipients, {
      enquiryId: enquiry.id,
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      message: enquiry.message,
      serviceType: enquiry.service_type,
      sourcePage: enquiry.source_page,
      createdAt: enquiry.created_at,
    });

    const status = result.success ? 'sent' : 'failed';

    await supabase.from('notification_events').insert({
      event_type: 'enquiry_manual_resend',
      entity_id: enquiry.id,
      provider: 'resend',
      status,
      attempt_count: 1,
      provider_message_id: result.providerId || null,
      last_error: result.error || null,
      sent_at: result.success ? new Date().toISOString() : null,
    });

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'manual_resend',
      module: 'notifications',
      entityType: 'enquiry',
      entityId: enquiry.id,
      details: { status, error: result.error || null },
    });

    return res.status(200).json({ success: result.success, status, error: result.error || null });
  } catch (error) {
    return serverError(res, error);
  }
}
