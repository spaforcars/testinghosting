import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBookingAssetUpload } from '../_lib/booking';
import { badRequest, methodNotAllowed, serverError } from '../_lib/http';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = (req.body || {}) as {
      filename?: string;
      contentType?: string;
      bookingReference?: string;
    };

    if (!body.filename || !body.contentType) {
      return badRequest(res, 'filename and contentType are required');
    }

    const supabase = getSupabaseAdmin();
    const upload = await createBookingAssetUpload(supabase, {
      filename: body.filename,
      contentType: body.contentType,
      bookingReference: body.bookingReference,
    });

    return res.status(200).json(upload);
  } catch (error) {
    return serverError(res, error);
  }
}
