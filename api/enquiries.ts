import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, methodNotAllowed, serverError } from './_lib/http';
import { getRetryDelayMinutes, parseDefaultRecipients, sendEnquiryAlertEmail } from './_lib/notifications';
import { writeAuditLog } from './_lib/audit';
import { notifyRoles } from './_lib/inAppNotifications';

interface CreateEnquiryBody {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  serviceType?: string;
  sourcePage?: string;
  metadata?: Record<string, unknown>;
}

const getEnabledRecipients = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  const { data } = await supabase
    .from('admin_notification_recipients')
    .select('email')
    .eq('enabled', true);

  if (data?.length) {
    return data.map((row) => row.email).filter(Boolean);
  }
  return parseDefaultRecipients();
};

const getAlertsEnabled = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'enquiry_alerts_enabled')
    .maybeSingle();
  return data?.value !== false;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = (req.body || {}) as CreateEnquiryBody;
    if (!body.name || !body.email || !body.message || !body.sourcePage) {
      return badRequest(res, 'name, email, message and sourcePage are required');
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: enquiry, error: enquiryError } = await supabase
      .from('enquiries')
      .insert({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        message: body.message,
        service_type: body.serviceType || null,
        source_page: body.sourcePage,
        metadata: body.metadata || {},
      })
      .select('*')
      .single();

    if (enquiryError || !enquiry) {
      throw new Error(enquiryError?.message || 'Failed to create enquiry');
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        enquiry_id: enquiry.id,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        service_type: enquiry.service_type,
        source_page: enquiry.source_page,
        status: 'lead',
      })
      .select('*')
      .single();
    if (leadError) {
      console.warn('Lead creation failed:', leadError.message);
    }

    const { data: notificationEvent, error: notificationInsertError } = await supabase
      .from('notification_events')
      .insert({
        event_type: 'enquiry_created',
        entity_id: enquiry.id,
        provider: 'resend',
        status: 'queued',
        attempt_count: 0,
      })
      .select('*')
      .single();

    if (notificationInsertError) {
      console.warn('Notification event insert failed:', notificationInsertError.message);
    }

    const alertsEnabled = await getAlertsEnabled(supabase);
    let emailStatus: 'sent' | 'failed' | 'disabled' = 'disabled';
    let notificationError: string | null = null;

    if (alertsEnabled) {
      const recipients = await getEnabledRecipients(supabase);
      const sendResult = await sendEnquiryAlertEmail(recipients, {
        enquiryId: enquiry.id,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        message: enquiry.message,
        serviceType: enquiry.service_type,
        sourcePage: enquiry.source_page,
        createdAt: now,
      });

      if (sendResult.success) {
        emailStatus = 'sent';
        await supabase
          .from('notification_events')
          .update({
            status: 'sent',
            attempt_count: 1,
            sent_at: now,
            provider_message_id: sendResult.providerId || null,
            last_error: null,
            next_retry_at: null,
          })
          .eq('id', notificationEvent?.id || '');
      } else {
        emailStatus = 'failed';
        notificationError = sendResult.error || 'Unknown email error';
        const retryInMin = getRetryDelayMinutes(1);
        const nextRetryAt = new Date(Date.now() + retryInMin * 60_000).toISOString();
        await supabase
          .from('notification_events')
          .update({
            status: 'failed',
            attempt_count: 1,
            last_error: notificationError,
            next_retry_at: nextRetryAt,
          })
          .eq('id', notificationEvent?.id || '');
      }
    }

    await writeAuditLog(supabase, {
      action: 'create',
      module: 'enquiries',
      entityType: 'enquiry',
      entityId: enquiry.id,
      details: {
        sourcePage: enquiry.source_page,
        serviceType: enquiry.service_type,
        emailStatus,
      },
    });

    await notifyRoles(
      supabase,
      ['super_admin', 'admin', 'staff'],
      {
        category: 'enquiry',
        title: 'New enquiry received',
        message: `${enquiry.name} submitted a ${enquiry.service_type || 'general'} request.`,
        entityType: 'lead',
        entityId: lead?.id || undefined,
        metadata: {
          enquiryId: enquiry.id,
          sourcePage: enquiry.source_page,
          serviceType: enquiry.service_type,
          emailStatus,
        },
      }
    );

    return res.status(200).json({
      enquiryId: enquiry.id,
      status: 'received',
      emailStatus,
      notificationError,
    });
  } catch (error) {
    console.error('Enquiry creation failed:', error);
    return serverError(res, error);
  }
}
