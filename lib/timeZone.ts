export const DEFAULT_APP_TIME_ZONE = 'America/Toronto';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string, options: Intl.DateTimeFormatOptions) => {
  const key = JSON.stringify({ timeZone, ...options });
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    ...options,
  });
  formatterCache.set(key, formatter);
  return formatter;
};

const readPartNumber = (lookup: Map<string, string>, key: string) => {
  const parsed = Number(lookup.get(key) || '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getTimeZoneParts = (value: string | Date, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = getFormatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: readPartNumber(lookup, 'year'),
    month: readPartNumber(lookup, 'month'),
    day: readPartNumber(lookup, 'day'),
    hour: readPartNumber(lookup, 'hour'),
    minute: readPartNumber(lookup, 'minute'),
    second: readPartNumber(lookup, 'second'),
  };
};

export const getTimeZoneDateKey = (value: string | Date, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const parts = getTimeZoneParts(value, timeZone);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const zonedDateTimeToUtc = (
  input: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone = DEFAULT_APP_TIME_ZONE
) => {
  const hour = input.hour ?? 0;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  const utcGuess = Date.UTC(input.year, input.month - 1, input.day, hour, minute, second);
  const guessDate = new Date(utcGuess);
  const parts = getTimeZoneParts(guessDate, timeZone);
  if (!parts) return new Date(utcGuess);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(utcGuess + (utcGuess - asUtc));
};

export const localDateKeyToUtcRange = (dateKey: string, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const start = zonedDateTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone);
  const end = zonedDateTimeToUtc({ year, month, day: day + 1, hour: 0, minute: 0, second: 0 }, timeZone);
  return { start, end };
};

export const shiftTimeZoneDateKey = (dateKey: string, days: number, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  return getTimeZoneDateKey(
    zonedDateTimeToUtc({ year, month, day: day + days, hour: 12, minute: 0, second: 0 }, timeZone),
    timeZone
  );
};

export const getStartOfTodayInTimeZone = (now = new Date(), timeZone = DEFAULT_APP_TIME_ZONE) =>
  localDateKeyToUtcRange(getTimeZoneDateKey(now, timeZone), timeZone).start;

export const getStartOfMonthInTimeZone = (now = new Date(), timeZone = DEFAULT_APP_TIME_ZONE) => {
  const parts = getTimeZoneParts(now, timeZone);
  if (!parts) return new Date(now);
  return zonedDateTimeToUtc({ year: parts.year, month: parts.month, day: 1, hour: 0, minute: 0, second: 0 }, timeZone);
};

export const isSameTimeZoneDate = (
  left: string | Date,
  right: string | Date,
  timeZone = DEFAULT_APP_TIME_ZONE
) => getTimeZoneDateKey(left, timeZone) === getTimeZoneDateKey(right, timeZone);

export const formatDateTimeInTimeZone = (
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  timeZone = DEFAULT_APP_TIME_ZONE
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return getFormatter(timeZone, options).format(date);
};

export const formatForDateTimeInput = (value: string | Date, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const parts = getTimeZoneParts(value, timeZone);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
};

export const dateTimeInputToUtcIso = (value: string, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  return zonedDateTimeToUtc(
    {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: 0,
    },
    timeZone
  ).toISOString();
};

export const parseDateTimeInputValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    dateKey: `${year}-${month}-${day}`,
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    totalMinutes: Number(hour) * 60 + Number(minute),
  };
};
