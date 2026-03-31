import { zonedDateTimeToUtc } from './booking';
import { calendarBlockSourceLabel, type CalendarBlockSource } from './calendarBlocks';

export type ParsedCalendarBlockIntent = {
  title: string;
  startAt: string;
  endAt: string;
  source: CalendarBlockSource;
  notes?: string | null;
};

const weekdayMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const monthMap: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const getLocalParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.get('year')),
    month: Number(lookup.get('month')),
    day: Number(lookup.get('day')),
    weekday: String(lookup.get('weekday') || '').toLowerCase(),
  };
};

const addDaysLocal = (
  base: { year: number; month: number; day: number },
  offset: number,
  timeZone: string
) => {
  const utc = zonedDateTimeToUtc({ ...base, hour: 12, minute: 0, second: 0 }, timeZone);
  utc.setUTCDate(utc.getUTCDate() + offset);
  return getLocalParts(utc, timeZone);
};

const parseDateRef = (question: string, timeZone: string) => {
  const lower = question.toLowerCase();
  const nowParts = getLocalParts(new Date(), timeZone);

  if (/\btoday\b/.test(lower)) return nowParts;
  if (/\btomorrow\b/.test(lower)) return addDaysLocal(nowParts, 1, timeZone);

  const isoMatch = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  }

  const monthMatch = lower.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\b/
  );
  if (monthMatch) {
    return {
      year: monthMatch[3] ? Number(monthMatch[3]) : nowParts.year,
      month: monthMap[monthMatch[1]],
      day: Number(monthMatch[2]),
    };
  }

  const weekdayMatch = lower.match(/\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const targetWeekday = weekdayMap[weekdayMatch[1]];
    const currentWeekday = weekdayMap[nowParts.weekday];
    let offset = (targetWeekday - currentWeekday + 7) % 7;
    if (lower.includes(`next ${weekdayMatch[1]}`) || offset === 0) offset += 7;
    return addDaysLocal(nowParts, offset, timeZone);
  }

  return null;
};

const parseTimeToken = (token: string, fallbackMeridiem?: 'am' | 'pm' | null) => {
  const match = token.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  const rawHour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = (match[3] as 'am' | 'pm' | undefined) || fallbackMeridiem || null;

  if (minute < 0 || minute > 59) return null;
  if (meridiem) {
    if (rawHour < 1 || rawHour > 12) return null;
    const normalizedHour = rawHour % 12 + (meridiem === 'pm' ? 12 : 0);
    return { hour: normalizedHour, minute, meridiem };
  }

  if (rawHour < 0 || rawHour > 23) return null;
  return { hour: rawHour, minute, meridiem: null };
};

const parseTimeRange = (question: string) => {
  const lower = question.toLowerCase();
  const match = lower.match(
    /\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*(?:-|to|until|till)\s*)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/
  );
  if (!match) return null;

  const firstHasMeridiem = /\b(am|pm)\b/.test(match[1]);
  const secondHasMeridiem = /\b(am|pm)\b/.test(match[2]);
  const first = parseTimeToken(match[1], secondHasMeridiem ? ((match[2].match(/\b(am|pm)\b/)?.[1] as 'am' | 'pm') || null) : null);
  const second = parseTimeToken(match[2], firstHasMeridiem ? ((match[1].match(/\b(am|pm)\b/)?.[1] as 'am' | 'pm') || null) : null);

  if (!first || !second) return null;
  if (second.hour * 60 + second.minute <= first.hour * 60 + first.minute) return null;

  return {
    startHour: first.hour,
    startMinute: first.minute,
    endHour: second.hour,
    endMinute: second.minute,
  };
};

const detectSource = (question: string): CalendarBlockSource => {
  const lower = question.toLowerCase();
  if (/walk[\s-]?in/.test(lower)) return 'walk_in';
  if (/doorstep|mobile/.test(lower)) return 'mobile';
  if (/support/.test(lower)) return 'support';
  return 'general';
};

export const maybeParseCalendarBlockIntent = (
  question: string,
  timeZone: string
): ParsedCalendarBlockIntent | null => {
  const lower = question.toLowerCase();
  if (!/(block|hold|reserve|close off|close-off|make unavailable)/.test(lower)) return null;

  const dateRef = parseDateRef(question, timeZone);
  const timeRange = parseTimeRange(question);
  if (!dateRef || !timeRange) return null;

  const source = detectSource(question);
  const start = zonedDateTimeToUtc(
    {
      year: dateRef.year,
      month: dateRef.month,
      day: dateRef.day,
      hour: timeRange.startHour,
      minute: timeRange.startMinute,
      second: 0,
    },
    timeZone
  );
  const end = zonedDateTimeToUtc(
    {
      year: dateRef.year,
      month: dateRef.month,
      day: dateRef.day,
      hour: timeRange.endHour,
      minute: timeRange.endMinute,
      second: 0,
    },
    timeZone
  );

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;

  return {
    title: calendarBlockSourceLabel(source),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    source,
    notes: null,
  };
};
