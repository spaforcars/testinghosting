import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adaptServicesContent } from '../../lib/contentAdapter';
import { defaultServicesPageContent } from '../../lib/cmsDefaults';
import { findOfferingByTitle, getOfferingById } from '../../lib/serviceCatalog';
import { DEFAULT_APP_TIME_ZONE } from '../../lib/timeZone';
import type { ServiceOffering, ServicesPageContent } from '../../types/cms';
import { getCmsPageData } from './cms';
import { listCalendarTimeBlocks, overlapsCalendarTimeBlock } from './calendarBlocks';

export type BookingMode = 'instant' | 'request';
export type BookingStatus = 'requested' | 'confirmed' | 'cancelled';

type BookingBusinessHours = {
  dayOfWeek: number;
  start: string;
  end: string;
};

export interface BookingSettings {
  timeZone: string;
  slotIntervalMinutes: number;
  bookingWindowDays: number;
  leadTimeHours: number;
  defaultBufferMinutes: number;
  manageTokenValidityHours: number;
  requestResponseSla: string;
  businessHours: BookingBusinessHours[];
}

export interface BookingServiceSelection {
  servicesContent: ServicesPageContent;
  primaryService: ServiceOffering;
  addOns: ServiceOffering[];
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  label: string;
  status: 'available' | 'full';
  message?: string;
}

interface ScheduledJobLike {
  id?: string | null;
  scheduled_at?: string | null;
  scheduled_end_at?: string | null;
  service_catalog_id?: string | null;
  service_addon_ids?: string[] | null;
  service_type?: string | null;
}

const defaultBusinessHours: BookingBusinessHours[] = [
  { dayOfWeek: 1, start: '08:00', end: '18:00' },
  { dayOfWeek: 2, start: '08:00', end: '18:00' },
  { dayOfWeek: 3, start: '08:00', end: '18:00' },
  { dayOfWeek: 4, start: '08:00', end: '18:00' },
  { dayOfWeek: 5, start: '08:00', end: '18:00' },
  { dayOfWeek: 6, start: '08:00', end: '18:00' },
];

export const defaultBookingSettings: BookingSettings = {
  timeZone: DEFAULT_APP_TIME_ZONE,
  slotIntervalMinutes: 30,
  bookingWindowDays: 60,
  leadTimeHours: 12,
  defaultBufferMinutes: 30,
  manageTokenValidityHours: 24 * 30,
  requestResponseSla: 'within 1 business day',
  businessHours: defaultBusinessHours,
};

export const BOOKING_CAPACITY_LIMIT = 2;
export const FULLY_BOOKED_SLOT_MESSAGE = 'Fully booked. Call Spa for Cars support.';
export const BOOKING_CAPACITY_CONFLICT_MESSAGE =
  'That appointment time is fully booked. Call Spa for Cars support.';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
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

const parseInteger = (value: string | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTimeParts = (date: Date, timeZone: string) => {
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
    year: parseInteger(lookup.get('year')),
    month: parseInteger(lookup.get('month')),
    day: parseInteger(lookup.get('day')),
    hour: parseInteger(lookup.get('hour')),
    minute: parseInteger(lookup.get('minute')),
    second: parseInteger(lookup.get('second')),
  };
};

const getWeekdayForDate = (date: Date, timeZone: string) => {
  const weekday = getFormatter(timeZone, { weekday: 'short' }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
};

export const getLocalDateKey = (date: Date, timeZone: string) => {
  const parts = getTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const formatSlotLabel = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

export const zonedDateTimeToUtc = (
  input: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string
) => {
  const hour = input.hour ?? 0;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  const utcGuess = Date.UTC(input.year, input.month - 1, input.day, hour, minute, second);
  const guessDate = new Date(utcGuess);
  const parts = getTimeParts(guessDate, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(utcGuess + (utcGuess - asUtc));
};

export const localDateStringToUtcRange = (dateKey: string, timeZone: string) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const start = zonedDateTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone);
  const end = zonedDateTimeToUtc({ year, month, day: day + 1, hour: 0, minute: 0, second: 0 }, timeZone);
  return { start, end };
};

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map((item) => Number(item));
  return hours * 60 + minutes;
};

const buildDateFromLocalMinutes = (dateKey: string, minutes: number, timeZone: string) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return zonedDateTimeToUtc({ year, month, day, hour, minute, second: 0 }, timeZone);
};

const sanitizeBusinessHours = (value: unknown): BookingBusinessHours[] => {
  if (!Array.isArray(value)) return defaultBusinessHours;

  const hours = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const dayOfWeek = Number(record.dayOfWeek);
      const start = typeof record.start === 'string' ? record.start : '';
      const end = typeof record.end === 'string' ? record.end : '';
      if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !start || !end) return null;
      return { dayOfWeek, start, end };
    })
    .filter(Boolean);

  return hours.length ? (hours as BookingBusinessHours[]) : defaultBusinessHours;
};

export const getBookingSettings = async (supabase: SupabaseClient): Promise<BookingSettings> => {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'booking_settings')
    .maybeSingle();

  const raw = data?.value && typeof data.value === 'object' ? (data.value as Record<string, unknown>) : {};

  return {
    timeZone: defaultBookingSettings.timeZone,
    slotIntervalMinutes:
      typeof raw.slotIntervalMinutes === 'number' && Number.isFinite(raw.slotIntervalMinutes)
        ? raw.slotIntervalMinutes
        : defaultBookingSettings.slotIntervalMinutes,
    bookingWindowDays:
      typeof raw.bookingWindowDays === 'number' && Number.isFinite(raw.bookingWindowDays)
        ? raw.bookingWindowDays
        : defaultBookingSettings.bookingWindowDays,
    leadTimeHours:
      typeof raw.leadTimeHours === 'number' && Number.isFinite(raw.leadTimeHours)
        ? raw.leadTimeHours
        : defaultBookingSettings.leadTimeHours,
    defaultBufferMinutes:
      typeof raw.defaultBufferMinutes === 'number' && Number.isFinite(raw.defaultBufferMinutes)
        ? raw.defaultBufferMinutes
        : defaultBookingSettings.defaultBufferMinutes,
    manageTokenValidityHours:
      typeof raw.manageTokenValidityHours === 'number' && Number.isFinite(raw.manageTokenValidityHours)
        ? raw.manageTokenValidityHours
        : defaultBookingSettings.manageTokenValidityHours,
    requestResponseSla:
      typeof raw.requestResponseSla === 'string' && raw.requestResponseSla.trim()
        ? raw.requestResponseSla
        : defaultBookingSettings.requestResponseSla,
    businessHours: sanitizeBusinessHours(raw.businessHours),
  };
};

export const getServicesContentForBooking = async (): Promise<ServicesPageContent> => {
  const cmsPage = await getCmsPageData('services');
  return adaptServicesContent(cmsPage || defaultServicesPageContent);
};

export const getBookingServiceSelection = async (
  serviceId: string,
  addOnIds: string[] = []
): Promise<BookingServiceSelection | null> => {
  const servicesContent = await getServicesContentForBooking();
  const primaryService = getOfferingById(servicesContent, serviceId);
  if (!primaryService || !primaryService.bookable) return null;

  const addOns = addOnIds
    .map((id) => getOfferingById(servicesContent, id))
    .filter((service): service is ServiceOffering => Boolean(service && service.addOnOnly));

  return { servicesContent, primaryService, addOns };
};

export const getServiceDurationMinutes = (
  service: ServiceOffering | null,
  addOns: ServiceOffering[] = [],
  fallbackMinutes = 120
) => {
  if (!service) return fallbackMinutes;
  const primaryDuration = service.slotDurationMinutes || fallbackMinutes;
  const addOnDuration = addOns.reduce((sum, addOn) => sum + (addOn.slotDurationMinutes || 0), 0);
  return primaryDuration + addOnDuration;
};

export const getServiceBufferMinutes = (service: ServiceOffering | null, settings: BookingSettings) =>
  service?.bufferMinutes ?? settings.defaultBufferMinutes;

const getJobWindow = (
  job: ScheduledJobLike,
  servicesContent: ServicesPageContent,
  settings: BookingSettings
) => {
  if (!job.scheduled_at) return null;

  const scheduledStart = new Date(job.scheduled_at);
  if (Number.isNaN(scheduledStart.getTime())) return null;

  const primaryService =
    getOfferingById(servicesContent, job.service_catalog_id) ||
    findOfferingByTitle(servicesContent, job.service_type);
  const addOns = (job.service_addon_ids || [])
    .map((id) => getOfferingById(servicesContent, id))
    .filter((service): service is ServiceOffering => Boolean(service));
  const durationMinutes = getServiceDurationMinutes(primaryService, addOns);
  const bufferMinutes = getServiceBufferMinutes(primaryService, settings);
  const scheduledEnd = job.scheduled_end_at
    ? new Date(job.scheduled_end_at)
    : new Date(scheduledStart.getTime() + (durationMinutes + bufferMinutes) * 60_000);

  if (Number.isNaN(scheduledEnd.getTime())) return null;

  return {
    start: scheduledStart,
    end: scheduledEnd,
  };
};

export const getScheduledEndAt = (
  scheduledAt: string | null | undefined,
  service: ServiceOffering | null,
  addOns: ServiceOffering[],
  settings: BookingSettings
) => {
  if (!scheduledAt) return null;
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  const durationMinutes = getServiceDurationMinutes(service, addOns);
  const bufferMinutes = getServiceBufferMinutes(service, settings);
  return new Date(start.getTime() + (durationMinutes + bufferMinutes) * 60_000).toISOString();
};

const loadScheduledJobsForAvailability = async (
  supabase: SupabaseClient,
  queryStart: string,
  queryEnd: string
): Promise<ScheduledJobLike[]> => {
  const modernQuery = await supabase
    .from('service_jobs')
    .select('id, scheduled_at, scheduled_end_at, service_catalog_id, service_addon_ids, service_type, status')
    .not('scheduled_at', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .lte('scheduled_at', queryEnd)
    .gte('scheduled_at', queryStart);

  if (!modernQuery.error) {
    return (modernQuery.data || []) as ScheduledJobLike[];
  }

  // Older datasets may not have the newer catalog/end-time columns yet.
  if (!/does not exist/i.test(modernQuery.error.message)) {
    throw new Error(modernQuery.error.message);
  }

  const legacyQuery = await supabase
    .from('service_jobs')
    .select('id, scheduled_at, service_type, status')
    .not('scheduled_at', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .lte('scheduled_at', queryEnd)
    .gte('scheduled_at', queryStart);

  if (legacyQuery.error) {
    throw new Error(legacyQuery.error.message);
  }

  return (legacyQuery.data || []) as ScheduledJobLike[];
};

const countWindowOverlaps = (
  occupiedWindows: Array<{ start: Date; end: Date }>,
  candidateStart: Date,
  candidateEnd: Date
) =>
  occupiedWindows.reduce(
    (count, window) => count + (candidateStart < window.end && candidateEnd > window.start ? 1 : 0),
    0
  );

export const checkInstantBookingCapacity = async (
  supabase: SupabaseClient,
  options: {
    serviceId: string;
    addOnIds?: string[];
    scheduledAt: string;
    excludeJobId?: string | null;
    ignoreCalendarBlocks?: boolean;
  }
): Promise<{
  settings: BookingSettings;
  primaryService: ServiceOffering;
  addOns: ServiceOffering[];
  slot: AvailabilitySlot;
  overlapCount: number;
  isAvailable: boolean;
}> => {
  const selection = await getBookingServiceSelection(options.serviceId, options.addOnIds || []);
  if (!selection) {
    throw new Error('Selected service is not available for booking');
  }

  if (selection.primaryService.bookingMode !== 'instant') {
    throw new Error('Selected service requires a request instead of instant booking');
  }

  const scheduledStart = new Date(options.scheduledAt);
  if (Number.isNaN(scheduledStart.getTime())) {
    throw new Error('scheduledAt must be a valid ISO timestamp');
  }

  const settings = await getBookingSettings(supabase);
  const durationMinutes = getServiceDurationMinutes(selection.primaryService, selection.addOns);
  const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
  const queryStart = new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const queryEnd = new Date(scheduledEnd.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const jobs = await loadScheduledJobsForAvailability(supabase, queryStart, queryEnd);
  const calendarBlocks = options.ignoreCalendarBlocks
    ? []
    : await listCalendarTimeBlocks(supabase, { startAt: queryStart, endAt: queryEnd });

  const occupiedWindows = jobs
    .filter((job) => String(job.id || '') !== String(options.excludeJobId || ''))
    .map((job) => getJobWindow(job, selection.servicesContent, settings))
    .filter(Boolean) as Array<{ start: Date; end: Date }>;

  const isBlockedByCalendar = overlapsCalendarTimeBlock(calendarBlocks, scheduledStart, scheduledEnd);
  const overlapCount = countWindowOverlaps(occupiedWindows, scheduledStart, scheduledEnd);
  const isAvailable = !isBlockedByCalendar && overlapCount < BOOKING_CAPACITY_LIMIT;

  return {
    settings,
    primaryService: selection.primaryService,
    addOns: selection.addOns,
    overlapCount,
    isAvailable,
    slot: {
      startAt: scheduledStart.toISOString(),
      endAt: scheduledEnd.toISOString(),
      label: formatSlotLabel(scheduledStart, settings.timeZone),
      status: isAvailable ? 'available' : 'full',
      message: isAvailable ? undefined : FULLY_BOOKED_SLOT_MESSAGE,
    },
  };
};

export const listAvailableSlots = async (
  supabase: SupabaseClient,
  options: {
    serviceId: string;
    addOnIds?: string[];
    dateKey: string;
  }
): Promise<{
  settings: BookingSettings;
  primaryService: ServiceOffering;
  addOns: ServiceOffering[];
  slots: AvailabilitySlot[];
}> => {
  const selection = await getBookingServiceSelection(options.serviceId, options.addOnIds || []);
  if (!selection) {
    throw new Error('Selected service is not available for booking');
  }

  if (selection.primaryService.bookingMode !== 'instant') {
    throw new Error('Selected service requires a request instead of instant booking');
  }

  const settings = await getBookingSettings(supabase);
  const { servicesContent, primaryService, addOns } = selection;
  const durationMinutes = getServiceDurationMinutes(primaryService, addOns);
  const localDate = options.dateKey;
  const { start, end } = localDateStringToUtcRange(localDate, settings.timeZone);
  const weekday = getWeekdayForDate(start, settings.timeZone);
  const businessHours = settings.businessHours.find((entry) => entry.dayOfWeek === weekday);

  if (!businessHours) {
    return { settings, primaryService, addOns, slots: [] };
  }

  const queryStart = new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const queryEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const jobs = await loadScheduledJobsForAvailability(supabase, queryStart, queryEnd);
  const calendarBlocks = await listCalendarTimeBlocks(supabase, { startAt: queryStart, endAt: queryEnd });

  const occupiedWindows = (jobs || [])
    .map((job) => getJobWindow(job, servicesContent, settings))
    .filter(Boolean) as Array<{ start: Date; end: Date }>;

  const now = new Date();
  const leadThreshold = new Date(now.getTime() + settings.leadTimeHours * 60 * 60 * 1000);
  const slots: AvailabilitySlot[] = [];
  const openMinutes = parseTimeToMinutes(businessHours.start);
  const closeMinutes = parseTimeToMinutes(businessHours.end);

  for (
    let candidateMinutes = openMinutes;
    candidateMinutes + durationMinutes <= closeMinutes;
    candidateMinutes += settings.slotIntervalMinutes
  ) {
    const candidateStart = buildDateFromLocalMinutes(localDate, candidateMinutes, settings.timeZone);
    const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60_000);
    if (candidateStart < leadThreshold) continue;

    const isBlockedByCalendar = overlapsCalendarTimeBlock(calendarBlocks, candidateStart, candidateEnd);
    const overlapCount = countWindowOverlaps(occupiedWindows, candidateStart, candidateEnd);
    const isAvailable = !isBlockedByCalendar && overlapCount < BOOKING_CAPACITY_LIMIT;
    slots.push({
      startAt: candidateStart.toISOString(),
      endAt: candidateEnd.toISOString(),
      label: formatSlotLabel(candidateStart, settings.timeZone),
      status: isAvailable ? 'available' : 'full',
      message: isAvailable ? undefined : FULLY_BOOKED_SLOT_MESSAGE,
    });
  }

  return { settings, primaryService, addOns, slots };
};

export const createBookingReference = () => {
  return `BKG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

export const createManageToken = () => crypto.randomBytes(24).toString('hex');

export const hashManageToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const buildManageLink = (baseUrl: string, reference: string, token: string) => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  return `${normalizedBaseUrl}/#/booking/manage/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`;
};

const sanitizeFileSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file';

export const getBookingAssetBucket = () => process.env.BOOKING_ASSET_BUCKET || 'booking-assets';

export const createBookingAssetUpload = async (
  supabase: SupabaseClient,
  options: {
    filename: string;
    contentType: string;
    bookingReference?: string;
  }
) => {
  const bucket = getBookingAssetBucket();
  const safeName = sanitizeFileSegment(options.filename);
  const prefix = options.bookingReference ? sanitizeFileSegment(options.bookingReference) : crypto.randomUUID();
  const path = `public-bookings/${new Date().toISOString().slice(0, 10)}/${prefix}-${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create upload URL');
  }

  return {
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    uploadUrl: `${process.env.SUPABASE_URL}/storage/v1${data.signedUrl}`,
    contentType: options.contentType,
  };
};
