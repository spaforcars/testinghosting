import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../_lib/auth';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../_lib/http';
import { writeAuditLog } from '../../_lib/audit';
import { isFeatureEnabled } from '../../_lib/featureFlags';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const clientId = readRouteId(req, 1);
    if (!clientId) return badRequest(res, 'client id is required');

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'clients', 'read')) return forbidden(res);
      const { data, error } = await supabase
        .from('customer_vehicles')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return res.status(200).json({ vehicles: data || [] });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'clients', 'write')) return forbidden(res);
      const body = req.body as {
        plate?: string;
        vin?: string;
        make?: string;
        model?: string;
        year?: number;
        color?: string;
        notes?: string;
      };

      const { data, error } = await supabase
        .from('customer_vehicles')
        .insert({
          client_id: clientId,
          plate: body.plate || null,
          vin: body.vin || null,
          make: body.make || null,
          model: body.model || null,
          year: body.year || null,
          color: body.color || null,
          notes: body.notes || null,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create_vehicle',
        module: 'clients',
        entityType: 'customer_vehicle',
        entityId: data.id,
        details: { clientId },
      });

      return res.status(201).json({ vehicle: data });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'clients', 'write')) return forbidden(res);
      const body = req.body as {
        vehicleId?: string;
        plate?: string | null;
        vin?: string | null;
        make?: string | null;
        model?: string | null;
        year?: number | null;
        color?: string | null;
        notes?: string | null;
      };

      if (!body.vehicleId) return badRequest(res, 'vehicleId is required');

      const updates: Record<string, unknown> = {};
      if (typeof body.plate !== 'undefined') updates.plate = body.plate || null;
      if (typeof body.vin !== 'undefined') updates.vin = body.vin || null;
      if (typeof body.make !== 'undefined') updates.make = body.make || null;
      if (typeof body.model !== 'undefined') updates.model = body.model || null;
      if (typeof body.year !== 'undefined') updates.year = body.year || null;
      if (typeof body.color !== 'undefined') updates.color = body.color || null;
      if (typeof body.notes !== 'undefined') updates.notes = body.notes || null;

      if (!Object.keys(updates).length) return badRequest(res, 'No updates provided');

      const { data, error } = await supabase
        .from('customer_vehicles')
        .update(updates)
        .eq('id', body.vehicleId)
        .eq('client_id', clientId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update_vehicle',
        module: 'clients',
        entityType: 'customer_vehicle',
        entityId: body.vehicleId,
        details: updates,
      });

      return res.status(200).json({ vehicle: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}
