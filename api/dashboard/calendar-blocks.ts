import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { writeAuditLog } from '../_lib/audit';
import {
  CalendarBlockSource,
  calendarBlockSourceLabel,
  listCalendarTimeBlocks,
  loadCalendarTimeBlocks,
  saveCalendarTimeBlocks,
  type CalendarTimeBlock,
} from '../_lib/calendarBlocks';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { badRequest, forbidden, methodNotAllowed, readQueryParam, serverError, unauthorized } from '../_lib/http';
import { getBookingSettings } from '../_lib/booking';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { zonedDateTimeToUtc } from '../../lib/timeZone';

const allowedSources: CalendarBlockSource[] = ['general', 'walk_in', 'mobile', 'support'];

const readBodyId = (req: VercelRequest) => {
  const raw = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).id : '';
  return typeof raw === 'string' ? raw.trim() : '';
};

const buildBlockTitle = (source: CalendarBlockSource, customTitle?: string) =>
  customTitle?.trim() || calendarBlockSourceLabel(source);

const readLocalBlockWindow = (
  body: {
    startAt?: string;
    endAt?: string;
    startDateKey?: string;
    startMinutes?: number;
    endDateKey?: string;
    endMinutes?: number;
  },
  timeZone: string
) => {
  if (
    typeof body.startDateKey !== 'string' ||
    typeof body.endDateKey !== 'string' ||
    typeof body.startMinutes !== 'number' ||
    typeof body.endMinutes !== 'number'
  ) {
    return null;
  }

  const startMatch = body.startDateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = body.endDateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!startMatch || !endMatch) return null;

  const [, startYear, startMonth, startDay] = startMatch;
  const [, endYear, endMonth, endDay] = endMatch;
  const startAt = zonedDateTimeToUtc(
    {
      year: Number(startYear),
      month: Number(startMonth),
      day: Number(startDay),
      hour: Math.floor(body.startMinutes / 60),
      minute: body.startMinutes % 60,
      second: 0,
    },
    timeZone
  );
  const endAt = zonedDateTimeToUtc(
    {
      year: Number(endYear),
      month: Number(endMonth),
      day: Number(endDay),
      hour: Math.floor(body.endMinutes / 60),
      minute: body.endMinutes % 60,
      second: 0,
    },
    timeZone
  );

  return { startAt, endAt };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'dashboard', 'read')) return forbidden(res);
      const dateFrom = readQueryParam(req, 'dateFrom') || null;
      const dateTo = readQueryParam(req, 'dateTo') || null;
      const blocks = await listCalendarTimeBlocks(supabase, { startAt: dateFrom, endAt: dateTo });
      return res.status(200).json({ blocks });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const bookingSettings = await getBookingSettings(supabase);
      const body = (req.body || {}) as {
        startAt?: string;
        endAt?: string;
        startDateKey?: string;
        startMinutes?: number;
        endDateKey?: string;
        endMinutes?: number;
        source?: CalendarBlockSource;
        title?: string;
        notes?: string;
      };

      if (
        (!body.startAt || !body.endAt) &&
        (
          typeof body.startDateKey !== 'string' ||
          typeof body.endDateKey !== 'string' ||
          typeof body.startMinutes !== 'number' ||
          typeof body.endMinutes !== 'number'
        )
      ) {
        return badRequest(res, 'start/end timestamps or local block window are required');
      }

      const localWindow = readLocalBlockWindow(body, bookingSettings.timeZone);
      const startAt = localWindow?.startAt || new Date(body.startAt || '');
      const endAt = localWindow?.endAt || new Date(body.endAt || '');
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        return badRequest(res, 'startAt and endAt must be valid ISO timestamps');
      }
      if (endAt.getTime() <= startAt.getTime()) {
        return badRequest(res, 'endAt must be after startAt');
      }

      const source = allowedSources.includes(body.source || 'general')
        ? (body.source as CalendarBlockSource)
        : 'general';
      const now = new Date().toISOString();
      const block: CalendarTimeBlock = {
        id: crypto.randomUUID(),
        title: buildBlockTitle(source, body.title),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        source,
        notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
        createdAt: now,
        updatedAt: now,
      };

      const current = await loadCalendarTimeBlocks(supabase);
      const blocks = await saveCalendarTimeBlocks(supabase, [...current, block], auth.userId);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create_calendar_block',
        module: 'dashboard',
        entityType: 'calendar_block',
        entityId: block.id,
        details: { ...block },
      });

      return res.status(201).json({ block, blocks });
    }

    if (req.method === 'DELETE') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const id = readQueryParam(req, 'id') || readBodyId(req);
      if (!id) return badRequest(res, 'id is required');

      const current = await loadCalendarTimeBlocks(supabase);
      const block = current.find((item) => item.id === id);
      if (!block) return badRequest(res, 'Calendar block not found');

      const blocks = await saveCalendarTimeBlocks(
        supabase,
        current.filter((item) => item.id !== id),
        auth.userId
      );

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'delete_calendar_block',
        module: 'dashboard',
        entityType: 'calendar_block',
        entityId: id,
        details: { ...block },
      });

      return res.status(200).json({ success: true, blocks });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}
