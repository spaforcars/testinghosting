import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  BOOKING_CAPACITY_CONFLICT_MESSAGE,
  checkInstantBookingCapacity,
  getBookingSettings,
  getScheduledEndAt,
  hashManageToken,
  listAvailableSlots,
} from '../../_lib/booking';
import { badRequest, methodNotAllowed, readQueryParam, readRouteId, serverError } from '../../_lib/http';
import { sendBookingCancellationEmail, sendBookingRescheduledEmail } from '../../_lib/notifications';
import { getBookingByReference } from '../../_lib/publicBookings';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';
import { getAppBaseUrl } from '../../_lib/appBaseUrl';

const trim = (value?: string | null) => (typeof value === 'string' ? value.trim() : '');

const authorize = async (
  req: VercelRequest,
  res: VercelResponse,
  reference: string
) => {
  const token = trim(readQueryParam(req, 'token') || String(req.body?.token || ''));
  if (!reference || !token) {
    res.status(400).json({ error: 'reference and token are required' });
    return null;
  }

  const supabase = getSupabaseAdmin();
  const booking = await getBookingByReference(supabase, reference);
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return null;
  }

  const expectedHash = booking.enquiry.public_manage_token_hash;
  const expiresAt = booking.enquiry.public_manage_token_expires_at
    ? new Date(booking.enquiry.public_manage_token_expires_at)
    : null;
  if (!expectedHash || hashManageToken(token) !== expectedHash) {
    res.status(401).json({ error: 'Invalid booking token' });
    return null;
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    res.status(401).json({ error: 'Booking token has expired' });
    return null;
  }

  return { supabase, booking, token };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') return methodNotAllowed(res);

  try {
    const reference = readRouteId(req).trim();
    const authorized = await authorize(req, res, reference);
    if (!authorized) return;

    const { supabase, booking, token } = authorized;
    const settings = await getBookingSettings(supabase);

    if (req.method === 'GET') {
      return res.status(200).json({
        bookingReference: booking.enquiry.booking_reference,
        bookingMode: booking.enquiry.booking_mode,
        status: booking.enquiry.status,
        manageTokenExpiresAt: booking.enquiry.public_manage_token_expires_at,
        service: booking.primaryService
          ? {
              id: booking.primaryService.id,
              title: booking.primaryService.title,
            }
          : null,
        addOns: booking.addOns.map((service) => ({ id: service.id, title: service.title })),
        contact: {
          name: booking.enquiry.name,
          email: booking.enquiry.email,
          phone: booking.enquiry.phone,
        },
        timing:
          booking.enquiry.booking_mode === 'instant'
            ? {
                scheduledAt: booking.serviceJob?.scheduled_at || booking.enquiry.metadata?.timing?.scheduledAt || null,
                timeZone: settings.timeZone,
              }
            : booking.enquiry.metadata?.timing || null,
        vehicle: booking.enquiry.metadata?.vehicle || null,
        pickup: booking.enquiry.metadata?.pickup || null,
        issueDetails: booking.enquiry.metadata?.issueDetails || null,
        notes: booking.enquiry.metadata?.notes || null,
        assets: booking.assets.map((asset) => ({
          id: asset.id,
          path: asset.storage_path,
          filename: asset.original_filename,
        })),
        manageUrl: `${getAppBaseUrl(req)}/#/booking/manage/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`,
      });
    }

    const body = (req.body || {}) as {
      action?: 'reschedule' | 'cancel' | 'updateRequest';
      scheduledAt?: string;
      preferredDate?: string;
      preferredDateTo?: string;
      preferredTimeWindow?: string;
      issueDetails?: string;
      notes?: string;
      pickupRequested?: boolean;
      pickupAddress?: Record<string, unknown>;
    };

    if (!body.action) {
      return badRequest(res, 'action is required');
    }

    if (body.action === 'reschedule') {
      if (booking.enquiry.booking_mode !== 'instant' || !booking.serviceJob) {
        return badRequest(res, 'Only confirmed instant bookings can be rescheduled');
      }
      if (!body.scheduledAt) {
        return badRequest(res, 'scheduledAt is required');
      }

      const requestedSlot = new Date(body.scheduledAt);
      if (Number.isNaN(requestedSlot.getTime())) {
        return badRequest(res, 'scheduledAt must be a valid ISO timestamp');
      }

      const serviceId = booking.primaryService?.id || booking.enquiry.service_catalog_id;
      if (!serviceId) {
        return badRequest(res, 'This booking cannot be rescheduled online');
      }

      const capacity = await checkInstantBookingCapacity(supabase, {
        serviceId,
        addOnIds: booking.enquiry.service_addon_ids || [],
        scheduledAt: requestedSlot.toISOString(),
        excludeJobId: booking.serviceJob.id,
      });

      if (!capacity.isAvailable) {
        return res.status(409).json({ error: BOOKING_CAPACITY_CONFLICT_MESSAGE });
      }

      const dateKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: settings.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(requestedSlot)
        .replaceAll('/', '-');

      const availability = await listAvailableSlots(supabase, {
        serviceId,
        addOnIds: booking.enquiry.service_addon_ids || [],
        dateKey,
      });

      const slot = availability.slots.find(
        (item) => item.startAt === requestedSlot.toISOString() && item.status === 'available'
      );
      if (!slot) {
        return res.status(409).json({ error: BOOKING_CAPACITY_CONFLICT_MESSAGE });
      }

      const scheduledEndAt = getScheduledEndAt(
        capacity.slot.startAt,
        booking.primaryService,
        booking.addOns,
        settings
      );
      const metadata = {
        ...(booking.enquiry.metadata || {}),
        timing: {
          ...(booking.enquiry.metadata?.timing || {}),
          scheduledAt: capacity.slot.startAt,
          timeZone: settings.timeZone,
        },
      };

      await supabase
        .from('enquiries')
        .update({
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.enquiry.id);

      await supabase
        .from('service_jobs')
        .update({
          scheduled_at: capacity.slot.startAt,
          scheduled_end_at: scheduledEndAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.serviceJob.id);

      await supabase.from('job_timeline_events').insert({
        service_job_id: booking.serviceJob.id,
        lead_id: booking.lead?.id || null,
        client_id: booking.serviceJob.client_id || null,
        event_type: 'public_booking_rescheduled',
        note: 'Customer rescheduled booking via manage link',
        metadata: {
          bookingReference: booking.enquiry.booking_reference,
          scheduledAt: capacity.slot.startAt,
        },
        created_by: null,
      });

      await sendBookingRescheduledEmail({
        to: booking.enquiry.email,
        customerName: booking.enquiry.name,
        bookingReference: booking.enquiry.booking_reference,
        serviceName: booking.enquiry.service_type,
        scheduledAt: capacity.slot.startAt,
        timeZone: settings.timeZone,
        manageLink: `${getAppBaseUrl(req)}/#/booking/manage/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`,
        pickupRequested: Boolean(booking.serviceJob.pickup_requested),
      });

      return res.status(200).json({
        status: 'confirmed',
        scheduledAt: capacity.slot.startAt,
        manageUrl: `${getAppBaseUrl(req)}/#/booking/manage/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`,
      });
    }

    if (body.action === 'cancel') {
      await supabase
        .from('enquiries')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.enquiry.id);

      if (booking.lead) {
        await supabase
          .from('leads')
          .update({
            status: 'closed_lost',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.lead.id);
      }

      if (booking.serviceJob) {
        await supabase
          .from('service_jobs')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.serviceJob.id);

        await supabase.from('job_timeline_events').insert({
          service_job_id: booking.serviceJob.id,
          lead_id: booking.lead?.id || null,
          client_id: booking.serviceJob.client_id || null,
          event_type: 'public_booking_cancelled',
          note: 'Customer cancelled booking via manage link',
          metadata: {
            bookingReference: booking.enquiry.booking_reference,
          },
          created_by: null,
        });
      }

      await sendBookingCancellationEmail({
        to: booking.enquiry.email,
        customerName: booking.enquiry.name,
        bookingReference: booking.enquiry.booking_reference,
        serviceName: booking.enquiry.service_type,
      });

      return res.status(200).json({ status: 'cancelled' });
    }

    if (body.action === 'updateRequest') {
      if (booking.enquiry.booking_mode !== 'request') {
        return badRequest(res, 'Only request bookings can be updated with updateRequest');
      }

      const metadata = {
        ...(booking.enquiry.metadata || {}),
        timing: {
          ...(booking.enquiry.metadata?.timing || {}),
          preferredDate: trim(body.preferredDate) || null,
          preferredDateTo: trim(body.preferredDateTo) || null,
          preferredTimeWindow: trim(body.preferredTimeWindow) || null,
        },
        issueDetails: trim(body.issueDetails) || null,
        notes: trim(body.notes) || null,
        pickup: {
          requested: Boolean(body.pickupRequested),
          address: body.pickupRequested ? body.pickupAddress || null : null,
        },
      };

      await supabase
        .from('enquiries')
        .update({
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.enquiry.id);

      if (booking.lead) {
        await supabase
          .from('leads')
          .update({
            intake_metadata: {
              ...(booking.lead.intake_metadata || {}),
              preferredSummary: [trim(body.preferredDate), trim(body.preferredDateTo), trim(body.preferredTimeWindow)]
                .filter(Boolean)
                .join(' | '),
              pickupRequested: Boolean(body.pickupRequested),
              pickupAddress: body.pickupRequested ? body.pickupAddress || null : null,
              issueDetails: trim(body.issueDetails) || null,
              notes: trim(body.notes) || null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.lead.id);
      }

      return res.status(200).json({ status: 'requested', updated: true });
    }

    return badRequest(res, 'Unsupported action');
  } catch (error) {
    return serverError(res, error);
  }
}
