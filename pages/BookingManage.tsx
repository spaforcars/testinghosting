import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, Lock, MapPin, RefreshCw, TriangleAlert, XCircle } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { ApiError, apiRequest } from '../lib/apiClient';
import { getTimeZoneDateKey, shiftTimeZoneDateKey, zonedDateTimeToUtc } from '../lib/timeZone';

type ManageBookingResponse = {
  bookingReference: string;
  bookingMode: 'instant' | 'request';
  status: 'confirmed' | 'requested' | 'cancelled';
  manageTokenExpiresAt?: string | null;
  service: { id: string; title: string } | null;
  addOns: Array<{ id: string; title: string }>;
  contact: { name: string; email: string; phone: string };
  timing:
    | {
        scheduledAt?: string | null;
        timeZone?: string;
      }
    | {
        preferredDate?: string | null;
        preferredDateTo?: string | null;
        preferredTimeWindow?: string | null;
      }
    | null;
  vehicle?: Record<string, unknown> | null;
  pickup?: { requested?: boolean; address?: Record<string, unknown> | null } | null;
  issueDetails?: string | null;
  notes?: string | null;
  assets: Array<{ id: string; path: string; filename: string }>;
  manageUrl: string;
};

type AvailabilityResponse = {
  timeZone: string;
  slots: Array<{
    startAt: string;
    endAt: string;
    label: string;
    status: 'available' | 'full';
    message?: string;
  }>;
};

const dateFmtKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .replaceAll('/', '-');

const dateFmtWeekday = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);

const dateFmtDay = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(date);

const dateFmtMonth = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' }).format(date);

const dateTimeLabel = (value: string | null | undefined, timeZone: string) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const nextDates = (count: number, timeZone: string) => {
  const dates: Date[] = [];
  let cursorKey = getTimeZoneDateKey(new Date(), timeZone);
  while (dates.length < count) {
    const [year, month, day] = cursorKey.split('-').map((value) => Number(value));
    const cursor = zonedDateTimeToUtc({ year, month, day, hour: 12, minute: 0, second: 0 }, timeZone);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(cursor);
    if (weekday !== 'Sun') dates.push(new Date(cursor));
    cursorKey = shiftTimeZoneDateKey(cursorKey, 1, timeZone);
  }
  return dates;
};

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const readAddress = (value: unknown) => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    addressLine1: readString(record.addressLine1),
    city: readString(record.city),
    province: readString(record.province),
    postalCode: readString(record.postalCode),
    notes: readString(record.notes),
  };
};

const requestTimeWindows = [
  'Morning (8 AM - 11 AM)',
  'Midday (11 AM - 2 PM)',
  'Afternoon (2 PM - 5 PM)',
  'Any time that day',
];

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}> = ({ label, value, onChange, placeholder = '', type = 'text', textarea = false }) => (
  <label className="block">
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{label}</div>
    {textarea ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-underline w-full resize-none min-h-[100px]"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-underline w-full"
      />
    )}
  </label>
);

const BookingManage: React.FC = () => {
  const { reference = '' } = useParams<{ reference: string }>();
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const [booking, setBooking] = useState<ManageBookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState<'reschedule' | 'updateRequest' | 'cancel' | ''>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availabilityTimeZone, setAvailabilityTimeZone] = useState('America/Toronto');
  const [slots, setSlots] = useState<AvailabilityResponse['slots']>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredDateTo, setPreferredDateTo] = useState('');
  const [preferredTimeWindow, setPreferredTimeWindow] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupRequested, setPickupRequested] = useState(false);
  const [pickupAddress, setPickupAddress] = useState({ addressLine1: '', city: '', province: '', postalCode: '', notes: '' });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const dateStripRef = useRef<HTMLDivElement>(null);
  const dateOptions = useMemo(() => nextDates(16, availabilityTimeZone), [availabilityTimeZone]);
  const addOnIds = useMemo(() => booking?.addOns.map((item) => item.id) || [], [booking]);
  const currentScheduledAt =
    booking?.bookingMode === 'instant' && booking.timing && 'scheduledAt' in booking.timing
      ? booking.timing.scheduledAt || null
      : null;

  const loadBooking = async () => {
    if (!reference || !token) {
      setError('The manage link is incomplete. Open the full link from the booking email.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const response = await apiRequest<ManageBookingResponse>(
        `/api/bookings/manage/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`
      );
      setBooking(response);
      setPickupRequested(Boolean(response.pickup?.requested));
      setPickupAddress(readAddress(response.pickup?.address));
      const resolvedTimeZone =
        response.bookingMode === 'instant' && response.timing && 'timeZone' in response.timing
          ? response.timing.timeZone || 'America/Toronto'
          : 'America/Toronto';
      setAvailabilityTimeZone(resolvedTimeZone);

      if (response.bookingMode === 'instant' && response.timing && 'scheduledAt' in response.timing) {
        const scheduledAt = response.timing.scheduledAt || '';
        if (scheduledAt) {
          const baseDate = new Date(scheduledAt);
          if (!Number.isNaN(baseDate.getTime())) {
            setSelectedDate(dateFmtKey(baseDate, resolvedTimeZone));
          }
        }
      } else if (response.bookingMode === 'request') {
        const timing = response.timing && 'preferredDate' in response.timing ? response.timing : null;
        setPreferredDate(readString(timing?.preferredDate));
        setPreferredDateTo(readString(timing?.preferredDateTo));
        setPreferredTimeWindow(readString(timing?.preferredTimeWindow));
        setIssueDetails(response.issueDetails || '');
        setNotes(response.notes || '');
      }
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBooking(); }, [reference, token]);

  useEffect(() => {
    if (!booking || booking.bookingMode !== 'instant' || !booking.service?.id || !selectedDate) {
      setSlots([]);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setAvailabilityError('');
    apiRequest<AvailabilityResponse>(
      `/api/booking/availability?serviceId=${encodeURIComponent(booking.service.id)}&date=${encodeURIComponent(selectedDate)}${
        addOnIds.length ? `&addOnIds=${encodeURIComponent(addOnIds.join(','))}` : ''
      }`
    )
      .then((response) => {
        if (!active) return;
        setAvailabilityTimeZone(response.timeZone || 'America/Toronto');
        setSlots(response.slots);
      })
      .catch((slotError) => {
        if (!active) return;
        setSlots([]);
        setAvailabilityError(slotError instanceof ApiError ? slotError.message : 'Failed to load slots');
      })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [addOnIds, booking, selectedDate]);

  useEffect(() => { setSelectedSlot(''); }, [selectedDate]);

  useEffect(() => {
    if (!selectedSlot) return;
    if (!slots.some((slot) => slot.startAt === selectedSlot && slot.status === 'available')) {
      setSelectedSlot('');
    }
  }, [selectedSlot, slots]);

  const submitReschedule = async () => {
    if (!booking || !selectedSlot) {
      setAvailabilityError('Choose a new slot before saving.');
      return;
    }
    try {
      setSubmitting('reschedule');
      setAvailabilityError('');
      setNotice('');
      await apiRequest(`/api/bookings/manage/${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        body: JSON.stringify({ token, action: 'reschedule', scheduledAt: selectedSlot }),
      });
      setNotice('Appointment updated. Confirmation email refreshed.');
      await loadBooking();
    } catch (submitError) {
      setAvailabilityError(submitError instanceof ApiError ? submitError.message : 'Failed to reschedule booking');
    } finally {
      setSubmitting('');
    }
  };

  const submitRequestUpdate = async () => {
    if (!booking) return;
    try {
      setSubmitting('updateRequest');
      setError('');
      setNotice('');
      await apiRequest(`/api/bookings/manage/${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          token, action: 'updateRequest', preferredDate, preferredDateTo, preferredTimeWindow, issueDetails, notes, pickupRequested,
          pickupAddress: pickupRequested ? pickupAddress : null,
        }),
      });
      setNotice('Request updated successfully.');
      await loadBooking();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Failed to update booking request');
    } finally {
      setSubmitting('');
    }
  };

  const cancelBooking = async () => {
    if (!booking) return;
    try {
      setSubmitting('cancel');
      setError('');
      setNotice('');
      await apiRequest(`/api/bookings/manage/${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        body: JSON.stringify({ token, action: 'cancel' }),
      });
      setNotice('Booking cancelled.');
      await loadBooking();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Failed to cancel booking');
    } finally {
      setSubmitting('');
    }
  };

  const scrollDateStrip = (dir: 'left' | 'right') => {
    dateStripRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  /* ── Loading ─────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-mclaren" />
          <p className="text-sm font-medium text-neutral-500">Loading booking details</p>
        </div>
      </div>
    );
  }

  /* ── Error (no booking loaded) ───────────────────────────────────── */

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-neutral-100 bg-white p-8 text-center">
          <TriangleAlert className="h-10 w-10 text-red-400 mx-auto" />
          <p className="mt-4 font-semibold text-brand-black">Link could not be opened</p>
          <p className="mt-2 text-sm text-neutral-500 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const isCancelled = booking.status === 'cancelled';

  /* ── Main Manage View ────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#fafafa] relative">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(255,122,0,0.05),transparent_70%)] z-0" />

      {/* ── Status Bar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-black/[0.04] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Ref</p>
              <p className="font-display text-lg font-semibold uppercase text-brand-black">{booking.bookingReference}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
              isCancelled ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {booking.status}
            </span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {booking.bookingMode === 'instant' ? 'Instant' : 'Request'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Notices ──────────────────────────────────────────────── */}
      {(notice || error) && (
        <div className="relative z-10 mx-auto max-w-2xl px-4 pt-4">
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mt-2">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-36 pt-8">
        <div className="step-enter">
          <div className="mb-10">
            <h1 className="font-display text-3xl md:text-4xl font-semibold uppercase leading-tight text-brand-black">
              {booking.bookingMode === 'instant' ? 'Reschedule or cancel' : 'Refine your request'}
            </h1>
            <p className="mt-3 text-base text-neutral-500 leading-relaxed">
              {booking.bookingMode === 'instant'
                ? 'Availability is rechecked before any changes are saved.'
                : 'Update your timing, pickup preferences, or assessment details.'}
            </p>
          </div>

          {booking.bookingMode === 'instant' ? (
            <>
              {/* Current appointment */}
              <div className="mb-8 rounded-2xl border border-neutral-100 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren mb-2">Current appointment</p>
                <p className="font-display text-2xl font-semibold uppercase text-brand-black">
                  {dateTimeLabel(currentScheduledAt, availabilityTimeZone)}
                </p>
              </div>

              {!isCancelled && (
                <>
                  {/* Date strip */}
                  <div className="mb-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 mb-4">Reschedule to</p>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => scrollDateStrip('left')}
                        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-md text-neutral-600 hover:text-brand-black transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div ref={dateStripRef} className="date-strip flex gap-2 overflow-x-auto px-6 py-1">
                        {dateOptions.map((day) => {
                          const key = dateFmtKey(day, availabilityTimeZone);
                          const isActive = selectedDate === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedDate(key)}
                              className={`shrink-0 flex flex-col items-center justify-center w-[68px] h-[80px] rounded-xl transition-all duration-200 ${
                                isActive
                                  ? 'bg-brand-black text-white shadow-lg pill-pop'
                                  : 'bg-white border border-neutral-100 text-neutral-600 hover:border-neutral-300 hover:shadow-sm'
                              }`}
                            >
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? 'text-brand-mclaren' : 'text-neutral-400'}`}>
                                {dateFmtWeekday(day, availabilityTimeZone)}
                              </span>
                              <span className="text-xl font-semibold mt-0.5">{dateFmtDay(day, availabilityTimeZone)}</span>
                              <span className={`text-[10px] ${isActive ? 'text-white/60' : 'text-neutral-400'}`}>
                                {dateFmtMonth(day, availabilityTimeZone)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => scrollDateStrip('right')}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-md text-neutral-600 hover:text-brand-black transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Time slots */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Available slots</p>
                        <p className="text-xs text-neutral-400 mt-1">Toronto time</p>
                      </div>
                      {loadingSlots && <LoaderCircle className="h-4 w-4 animate-spin text-brand-mclaren" />}
                    </div>
                    {availabilityError && <p className="mb-4 text-sm text-red-500">{availabilityError}</p>}
                    {selectedDate && slots.length ? (
                      <div className="grid grid-cols-2 gap-3">
                        {slots.map((slot) => {
                          const isFull = slot.status === 'full';
                          const isActive = selectedSlot === slot.startAt;
                          return (
                            <button
                              key={slot.startAt}
                              type="button"
                              disabled={isFull}
                              onClick={() => { if (!isFull) setSelectedSlot(slot.startAt); }}
                              className={`relative rounded-xl px-4 py-4 text-left transition-all duration-200 overflow-hidden ${
                                isFull
                                  ? 'bg-neutral-50 text-neutral-300 cursor-not-allowed border border-neutral-100'
                                  : isActive
                                    ? 'bg-brand-mclaren text-white shadow-lg booking-cta'
                                    : 'bg-white border border-neutral-100 text-brand-black hover:border-brand-mclaren/40 hover:shadow-md'
                              }`}
                            >
                              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                                isFull ? 'text-neutral-300' : isActive ? 'text-white/70' : 'text-neutral-400'
                              }`}>
                                {isFull ? 'Fully booked' : 'Available'}
                              </p>
                              <p className={`font-display text-xl font-semibold uppercase ${isFull ? 'line-through' : ''}`}>
                                {slot.label}
                              </p>
                              {isFull && slot.message && <p className="mt-1 text-xs text-neutral-300">{slot.message}</p>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-10 text-center text-sm text-neutral-400">
                        {selectedDate ? 'No slots available for this date.' : 'Select a date to see available times.'}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mb-8">
                    <Button onClick={submitReschedule} disabled={submitting === 'reschedule'}>
                      {submitting === 'reschedule' ? 'Saving...' : 'Save new slot'}
                    </Button>
                    <Button variant="outline" onClick={() => void loadBooking()} disabled={submitting !== ''}>
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* ── Request mode edit ───────────────────────────────── */
            <>
              <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Field label="Preferred date" type="date" value={preferredDate} onChange={setPreferredDate} />
                <Field label="Backup date" type="date" value={preferredDateTo} onChange={setPreferredDateTo} />
              </div>

              <div className="mb-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 mb-3">Time window</p>
                <div className="flex flex-wrap gap-2">
                  {requestTimeWindows.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPreferredTimeWindow(w)}
                      className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                        preferredTimeWindow === w
                          ? 'bg-brand-black text-white shadow-md pill-pop'
                          : 'border border-neutral-200 text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6 mb-8">
                <Field label="Issue details" value={issueDetails} onChange={setIssueDetails} placeholder="Tell the team what needs to be assessed." textarea />
                <Field label="Extra notes" value={notes} onChange={setNotes} placeholder="Anything else that changed?" textarea />
              </div>

              {/* Pickup */}
              <div className="mb-8 rounded-2xl border border-neutral-100 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">Pickup & drop-off</p>
                    <p className="mt-1 text-sm text-neutral-500">Confirmed manually by the team.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickupRequested((c) => !c)}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-200 ${
                      pickupRequested
                        ? 'bg-brand-mclaren text-white shadow-md'
                        : 'border border-neutral-200 text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    {pickupRequested ? 'Pickup requested' : 'Request pickup'}
                  </button>
                </div>
                {pickupRequested && (
                  <div className="mt-5 grid gap-6 md:grid-cols-2">
                    <Field label="Address" value={pickupAddress.addressLine1} onChange={(v) => setPickupAddress((c) => ({ ...c, addressLine1: v }))} placeholder="123 Main St" />
                    <Field label="City" value={pickupAddress.city} onChange={(v) => setPickupAddress((c) => ({ ...c, city: v }))} placeholder="Aurora" />
                    <Field label="Province" value={pickupAddress.province} onChange={(v) => setPickupAddress((c) => ({ ...c, province: v }))} placeholder="Ontario" />
                    <Field label="Postal code" value={pickupAddress.postalCode} onChange={(v) => setPickupAddress((c) => ({ ...c, postalCode: v }))} placeholder="A1A 1A1" />
                    <Field label="Access notes" value={pickupAddress.notes} onChange={(v) => setPickupAddress((c) => ({ ...c, notes: v }))} placeholder="Gate code, parking instructions" />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 mb-8">
                <Button onClick={submitRequestUpdate} disabled={submitting === 'updateRequest' || isCancelled}>
                  {submitting === 'updateRequest' ? 'Saving...' : 'Update request'}
                </Button>
                <Button variant="outline" onClick={() => void loadBooking()} disabled={submitting !== ''}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
            </>
          )}

          {/* ── Cancel Accordion ──────────────────────────────────── */}
          {!isCancelled && (
            <div className="rounded-2xl border border-neutral-100 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setCancelOpen((c) => !c)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-medium text-neutral-600">Need to cancel?</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform duration-200 ${cancelOpen ? 'rotate-180' : ''}`} />
              </button>
              {cancelOpen && (
                <div className="px-5 pb-5 border-t border-neutral-100 pt-4">
                  <p className="text-sm text-neutral-500 leading-relaxed mb-4">
                    Cancelling closes the booking immediately and sends a notification email.
                  </p>
                  <button
                    type="button"
                    onClick={cancelBooking}
                    disabled={submitting === 'cancel'}
                    className="rounded-full border border-red-200 px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {submitting === 'cancel' ? 'Cancelling...' : 'Cancel booking'}
                  </button>
                </div>
              )}
            </div>
          )}
          {isCancelled && (
            <div className="rounded-2xl border border-red-100 bg-red-50/50 px-5 py-4 text-center">
              <p className="text-sm font-medium text-red-500">This booking has been cancelled.</p>
            </div>
          )}
        </div>
      </main>

      {/* ── Floating Summary Bar ─────────────────────────────────── */}
      {booking.service && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-black/[0.06] bg-white/90 backdrop-blur-xl shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-black truncate">{booking.service.title}</p>
              <p className="text-xs text-neutral-500">{booking.contact.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              className="shrink-0 ml-4 rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-black hover:border-brand-mclaren hover:text-brand-mclaren transition-colors"
            >
              Summary
            </button>
          </div>
        </div>
      )}

      {/* ── Summary Drawer ───────────────────────────────────────── */}
      {summaryOpen && (
        <div className="fixed inset-0 z-50">
          <div className="summary-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSummaryOpen(false)} />
          <div className="summary-drawer absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-brand-black text-white">
            <div className="sticky top-0 z-10 flex items-center justify-center pt-4 pb-2 bg-brand-black rounded-t-3xl">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-6 pb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Booking summary</p>
              <h2 className="mt-2 font-display text-2xl font-semibold uppercase">{booking.service?.title || 'Service booking'}</h2>

              {!!booking.addOns.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.addOns.map((addOn) => (
                    <span key={addOn.id} className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                      {addOn.title}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Customer</p>
                  <p className="text-sm font-medium">{booking.contact.name}</p>
                  <p className="text-xs text-white/50 mt-0.5">{booking.contact.email}</p>
                  <p className="text-xs text-white/50 mt-0.5">{booking.contact.phone}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Timing</p>
                  <p className="text-sm font-medium">
                    {booking.bookingMode === 'instant'
                      ? dateTimeLabel(currentScheduledAt, availabilityTimeZone)
                      : [readString((booking.timing as Record<string, unknown> | null)?.preferredDate), readString((booking.timing as Record<string, unknown> | null)?.preferredTimeWindow)]
                          .filter(Boolean)
                          .join(' | ') || 'Still open'}
                  </p>
                </div>

                {booking.pickup?.requested && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mclaren mb-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Pickup
                    </p>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {[pickupAddress.addressLine1, pickupAddress.city, pickupAddress.province, pickupAddress.postalCode]
                        .filter(Boolean)
                        .join(', ') || 'Address shared with the team'}
                    </p>
                  </div>
                )}

                {!!booking.assets.length && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Photos</p>
                    <div className="space-y-1">
                      {booking.assets.map((asset) => (
                        <p key={asset.id} className="text-sm text-white/60">{asset.filename}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-xl border border-brand-mclaren/20 bg-brand-mclaren/10 p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mclaren mb-2">
                  <Lock className="h-3.5 w-3.5" />
                  Link security
                </p>
                <p className="text-sm leading-relaxed text-white/60">
                  Active until {booking.manageTokenExpiresAt ? dateTimeLabel(booking.manageTokenExpiresAt, availabilityTimeZone) : 'the configured expiry time'}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                className="mt-6 w-full rounded-full border border-white/15 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white/70 hover:bg-white/5 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ServiceNotice />
    </div>
  );
};

export default BookingManage;
