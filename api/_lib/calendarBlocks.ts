import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CalendarBlockSource = 'general' | 'walk_in' | 'mobile' | 'support';

export interface CalendarTimeBlock {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  source: CalendarBlockSource;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

const CALENDAR_BLOCKS_KEY = 'calendar_time_blocks';
const calendarBlockSources: CalendarBlockSource[] = ['general', 'walk_in', 'mobile', 'support'];

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isValidIso = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const sanitizeSource = (value: unknown): CalendarBlockSource =>
  calendarBlockSources.includes(value as CalendarBlockSource) ? (value as CalendarBlockSource) : 'general';

const sanitizeBlock = (value: unknown): CalendarTimeBlock | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = readString(record.id) || crypto.randomUUID();
  const title = readString(record.title) || 'Blocked time';
  const startAt = readString(record.startAt);
  const endAt = readString(record.endAt);
  if (!isValidIso(startAt) || !isValidIso(endAt)) return null;
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return null;

  const createdAt = readString(record.createdAt);
  const updatedAt = readString(record.updatedAt);

  return {
    id,
    title,
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
    source: sanitizeSource(record.source),
    notes: readString(record.notes) || null,
    createdAt: isValidIso(createdAt) ? new Date(createdAt).toISOString() : new Date().toISOString(),
    updatedAt: isValidIso(updatedAt) ? new Date(updatedAt).toISOString() : new Date().toISOString(),
  };
};

const sortBlocks = (blocks: CalendarTimeBlock[]) =>
  [...blocks].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

export const calendarBlockSourceLabel = (source: CalendarBlockSource) =>
  source === 'walk_in'
    ? 'Walk-in hold'
    : source === 'mobile'
      ? 'Doorstep hold'
      : source === 'support'
        ? 'Support hold'
        : 'Blocked time';

export const loadCalendarTimeBlocks = async (supabase: SupabaseClient): Promise<CalendarTimeBlock[]> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', CALENDAR_BLOCKS_KEY)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const raw = data?.value;
  if (!Array.isArray(raw)) return [];
  return sortBlocks(raw.map(sanitizeBlock).filter(Boolean) as CalendarTimeBlock[]);
};

export const saveCalendarTimeBlocks = async (
  supabase: SupabaseClient,
  blocks: CalendarTimeBlock[],
  updatedBy?: string | null
) => {
  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      key: CALENDAR_BLOCKS_KEY,
      value: sortBlocks(blocks),
      updated_by: updatedBy || null,
    })
    .select('value')
    .single();

  if (error) throw new Error(error.message);
  const raw = data?.value;
  return Array.isArray(raw) ? (raw.map(sanitizeBlock).filter(Boolean) as CalendarTimeBlock[]) : [];
};

export const listCalendarTimeBlocks = async (
  supabase: SupabaseClient,
  options?: { startAt?: string | null; endAt?: string | null }
) => {
  const blocks = await loadCalendarTimeBlocks(supabase);
  const rangeStart = options?.startAt ? new Date(options.startAt) : null;
  const rangeEnd = options?.endAt ? new Date(options.endAt) : null;

  if ((rangeStart && Number.isNaN(rangeStart.getTime())) || (rangeEnd && Number.isNaN(rangeEnd.getTime()))) {
    return blocks;
  }

  return blocks.filter((block) => {
    const start = new Date(block.startAt);
    const end = new Date(block.endAt);
    if (rangeStart && end <= rangeStart) return false;
    if (rangeEnd && start >= rangeEnd) return false;
    return true;
  });
};

export const overlapsCalendarTimeBlock = (
  blocks: Array<Pick<CalendarTimeBlock, 'startAt' | 'endAt'>>,
  candidateStart: Date,
  candidateEnd: Date
) =>
  blocks.some((block) => {
    const start = new Date(block.startAt);
    const end = new Date(block.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return candidateStart < end && candidateEnd > start;
  });
