import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listAvailableSlots } from '../_lib/booking';
import { badRequest, methodNotAllowed, serverError } from '../_lib/http';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const serviceId = String(req.query.serviceId || '').trim();
    const date = String(req.query.date || '').trim();
    const addOnIds = typeof req.query.addOnIds === 'string'
      ? req.query.addOnIds.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

    if (!serviceId || !date) {
      return badRequest(res, 'serviceId and date are required');
    }

    const supabase = getSupabaseAdmin();
    const availability = await listAvailableSlots(supabase, {
      serviceId,
      addOnIds,
      dateKey: date,
    });

    return res.status(200).json({
      timeZone: availability.settings.timeZone,
      bookingWindowDays: availability.settings.bookingWindowDays,
      leadTimeHours: availability.settings.leadTimeHours,
      service: {
        id: availability.primaryService.id,
        title: availability.primaryService.title,
      },
      slots: availability.slots,
    });
  } catch (error) {
    return serverError(res, error);
  }
}
