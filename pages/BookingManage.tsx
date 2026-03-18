import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { CalendarDays, LoaderCircle, MapPin, RefreshCw, TriangleAlert, XCircle } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { ApiError, apiRequest } from '../lib/apiClient';

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
  slots: Array<{ startAt: string; endAt: string; label: string }>;
};

const dateKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .replaceAll('/', '-');

const dateLabel = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(date);

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
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (dates.length < count) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(cursor);
    if (weekday !== 'Sun') dates.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
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
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</div>
    {textarea ? (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-32 w-full resize-none rounded-[20px] border border-black/[0.08] bg-[#f7f4ee] px-4 py-3 text-base text-brand-black outline-none"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[20px] border border-black/[0.08] bg-[#f7f4ee] px-4 py-3 text-base text-brand-black outline-none"
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
  const [slots, setSlots] = useState<Array<{ startAt: string; endAt: string; label: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredDateTo, setPreferredDateTo] = useState('');
  const [preferredTimeWindow, setPreferredTimeWindow] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupRequested, setPickupRequested] = useState(false);
  const [pickupAddress, setPickupAddress] = useState({
    addressLine1: '',
    city: '',
    province: '',
    postalCode: '',
    notes: '',
  });

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
            setSelectedDate(dateKey(baseDate, resolvedTimeZone));
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

  useEffect(() => {
    void loadBooking();
  }, [reference, token]);

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
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [addOnIds, booking, selectedDate]);

  useEffect(() => {
    setSelectedSlot('');
  }, [selectedDate]);

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
        body: JSON.stringify({
          token,
          action: 'reschedule',
          scheduledAt: selectedSlot,
        }),
      });
      setNotice('Appointment updated. The customer confirmation email has been refreshed.');
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
          token,
          action: 'updateRequest',
          preferredDate,
          preferredDateTo,
          preferredTimeWindow,
          issueDetails,
          notes,
          pickupRequested,
          pickupAddress: pickupRequested ? pickupAddress : null,
        }),
      });
      setNotice('Request updated. The ops queue now has the latest timing and intake details.');
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
        body: JSON.stringify({
          token,
          action: 'cancel',
        }),
      });
      setNotice('Booking cancelled.');
      await loadBooking();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Failed to cancel booking');
    } finally {
      setSubmitting('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2eee6] px-4 py-16">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 rounded-[30px] bg-white px-6 py-10 shadow-[0_30px_90px_-55px_rgba(0,0,0,0.35)]">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-mclaren" />
          <p className="text-sm font-medium text-neutral-600">Loading booking details</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-[#f2eee6] px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-white p-8 shadow-[0_30px_90px_-55px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3 text-red-600">
            <TriangleAlert className="h-6 w-6" />
            <p className="font-semibold">This manage link could not be opened.</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const isCancelled = booking.status === 'cancelled';

  return (
    <div className="min-h-screen bg-[#f2eee6]">
      <section className="bg-brand-black px-4 pb-14 pt-16 text-white">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-mclaren/25 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
              Manage Booking
            </p>
            <h1 className="mt-6 font-display text-5xl font-semibold uppercase leading-[0.95] md:text-6xl">
              {booking.bookingMode === 'instant' ? 'Reschedule or cancel.' : 'Refine the request.'}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72">
              {booking.bookingMode === 'instant'
                ? 'Real availability is checked again before the appointment is changed.'
                : 'Update timing preferences, pickup details, and assessment notes without starting over.'}
            </p>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-white/8 p-6">
            <div className="grid gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Booking reference</p>
                <p className="mt-2 font-display text-2xl font-semibold">{booking.bookingReference}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Status</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${isCancelled ? 'bg-red-500/15 text-red-300' : 'bg-brand-mclaren/12 text-brand-mclaren'}`}>
                    {booking.status}
                  </span>
                  <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                    {booking.bookingMode === 'instant' ? 'Instant booking' : 'Request booking'}
                  </span>
                </div>
              </div>
              {notice && (
                <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
                  {notice}
                </div>
              )}
              {error && (
                <div className="rounded-[22px] border border-red-400/20 bg-red-400/10 p-4 text-sm leading-6 text-red-100">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6 rounded-[34px] border border-black/[0.06] bg-white p-6 shadow-[0_30px_90px_-55px_rgba(0,0,0,0.35)] md:p-8">
            {booking.bookingMode === 'instant' ? (
              <>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Current appointment</p>
                  <p className="mt-3 font-display text-3xl font-semibold uppercase text-brand-black">
                    {dateTimeLabel(currentScheduledAt, availabilityTimeZone)}
                  </p>
                </div>
                {!isCancelled && (
                  <>
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {dateOptions.map((day) => {
                        const key = dateKey(day, availabilityTimeZone);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedDate(key)}
                            className={`rounded-[20px] border px-4 py-4 text-left ${selectedDate === key ? 'border-brand-mclaren bg-brand-black text-white' : 'border-black/[0.08] bg-[#f7f4ee] text-brand-black'}`}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">Open day</p>
                            <p className="mt-2 font-medium">{dateLabel(day, availabilityTimeZone)}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-[28px] bg-brand-black p-6 text-white">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Reschedule to</p>
                          <p className="mt-2 font-display text-2xl font-semibold uppercase">{selectedDate || 'Pick a day first'}</p>
                        </div>
                        {loadingSlots && <LoaderCircle className="h-5 w-5 animate-spin text-brand-mclaren" />}
                      </div>
                      {selectedDate && slots.length ? (
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          {slots.map((slot) => (
                            <button
                              key={slot.startAt}
                              type="button"
                              onClick={() => setSelectedSlot(slot.startAt)}
                              className={`rounded-[20px] border px-4 py-4 text-left ${selectedSlot === slot.startAt ? 'border-brand-mclaren bg-brand-mclaren/12 text-white' : 'border-white/10 bg-white/6 text-white/80'}`}
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">Available slot</p>
                              <p className="mt-2 font-display text-2xl font-semibold uppercase">{slot.label}</p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-[22px] border border-dashed border-white/12 bg-white/6 px-4 py-8 text-center text-sm text-white/60">
                          {selectedDate ? 'No slots are open on that day.' : 'Choose a day to load slots.'}
                        </div>
                      )}
                      {availabilityError && <p className="mt-4 text-sm text-red-300">{availabilityError}</p>}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={submitReschedule} disabled={submitting === 'reschedule'}>
                        {submitting === 'reschedule' ? 'Saving...' : 'Save new slot'}
                      </Button>
                      <Button variant="outline" onClick={() => void loadBooking()} disabled={submitting !== ''}>
                        Refresh booking
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Preferred date" type="date" value={preferredDate} onChange={setPreferredDate} />
                  <Field label="Backup date" type="date" value={preferredDateTo} onChange={setPreferredDateTo} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {requestTimeWindows.map((window) => (
                    <button
                      key={window}
                      type="button"
                      onClick={() => setPreferredTimeWindow(window)}
                      className={`rounded-[20px] border px-4 py-4 text-left ${preferredTimeWindow === window ? 'border-brand-mclaren bg-brand-black text-white' : 'border-black/[0.08] bg-[#f7f4ee] text-brand-black'}`}
                    >
                      {window}
                    </button>
                  ))}
                </div>
                <Field label="Issue details" value={issueDetails} onChange={setIssueDetails} placeholder="Tell the team what needs to be assessed." textarea />
                <Field label="Extra notes" value={notes} onChange={setNotes} placeholder="Anything else that changed?" textarea />
                <div className="rounded-[28px] bg-brand-black p-6 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Pickup request</p>
                      <p className="mt-2 text-sm text-white/68">Pickup and drop-off stays a request until the team confirms it.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickupRequested((current) => !current)}
                      className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] ${pickupRequested ? 'bg-brand-mclaren text-white' : 'border border-white/12 bg-white/8 text-white/80'}`}
                    >
                      {pickupRequested ? 'Pickup requested' : 'Request pickup'}
                    </button>
                  </div>
                  {pickupRequested && (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <Field label="Address line 1" value={pickupAddress.addressLine1} onChange={(value) => setPickupAddress((current) => ({ ...current, addressLine1: value }))} placeholder="123 Main St" />
                      <Field label="City" value={pickupAddress.city} onChange={(value) => setPickupAddress((current) => ({ ...current, city: value }))} placeholder="Aurora" />
                      <Field label="Province" value={pickupAddress.province} onChange={(value) => setPickupAddress((current) => ({ ...current, province: value }))} placeholder="Ontario" />
                      <Field label="Postal code" value={pickupAddress.postalCode} onChange={(value) => setPickupAddress((current) => ({ ...current, postalCode: value }))} placeholder="A1A 1A1" />
                      <Field label="Access notes" value={pickupAddress.notes} onChange={(value) => setPickupAddress((current) => ({ ...current, notes: value }))} placeholder="Gate code, parking instructions" />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={submitRequestUpdate} disabled={submitting === 'updateRequest' || isCancelled}>
                    {submitting === 'updateRequest' ? 'Saving...' : 'Update request'}
                  </Button>
                  <Button variant="outline" onClick={() => void loadBooking()} disabled={submitting !== ''}>
                    Refresh request
                  </Button>
                </div>
              </>
            )}

            <div className="rounded-[28px] border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <XCircle className="mt-1 h-5 w-5 text-red-500" />
                <div>
                  <p className="font-semibold text-red-700">Need to cancel?</p>
                  <p className="mt-2 text-sm leading-6 text-red-700/80">
                    Cancelling closes the booking or request immediately and notifies the customer by email.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="outline" onClick={cancelBooking} disabled={submitting === 'cancel' || isCancelled}>
                  {isCancelled ? 'Already cancelled' : submitting === 'cancel' ? 'Cancelling...' : 'Cancel booking'}
                </Button>
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-[34px] bg-brand-black p-6 text-white shadow-[0_40px_120px_-60px_rgba(0,0,0,0.85)] lg:sticky lg:top-24">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Booking summary</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">{booking.service?.title || 'Service booking'}</h2>
            {!!booking.addOns.length && (
              <div className="mt-4 flex flex-wrap gap-2">
                {booking.addOns.map((addOn) => (
                  <span key={addOn.id} className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                    {addOn.title}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Customer</p>
                <p className="mt-2 text-base font-medium">{booking.contact.name}</p>
                <p className="mt-1 text-sm text-white/60">{booking.contact.email}</p>
                <p className="mt-1 text-sm text-white/60">{booking.contact.phone}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Timing</p>
                <p className="mt-2 text-base font-medium">
                  {booking.bookingMode === 'instant'
                    ? dateTimeLabel(currentScheduledAt, availabilityTimeZone)
                    : [readString((booking.timing as Record<string, unknown> | null)?.preferredDate), readString((booking.timing as Record<string, unknown> | null)?.preferredTimeWindow)]
                        .filter(Boolean)
                        .join(' | ') || 'Still open'}
                </p>
              </div>
              {booking.pickup?.requested && (
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                    <MapPin className="h-4 w-4" />
                    Pickup request
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/72">
                    {[pickupAddress.addressLine1, pickupAddress.city, pickupAddress.province, pickupAddress.postalCode]
                      .filter(Boolean)
                      .join(', ') || 'Address shared with the team'}
                  </p>
                </div>
              )}
              {!!booking.assets.length && (
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Photos shared</p>
                  <div className="mt-3 space-y-2">
                    {booking.assets.map((asset) => (
                      <p key={asset.id} className="text-sm text-white/72">
                        {asset.filename}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 rounded-[24px] border border-brand-mclaren/20 bg-brand-mclaren/10 p-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                {booking.bookingMode === 'instant' ? <CalendarDays className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Link security
              </p>
              <p className="mt-3 text-sm leading-6 text-white/78">
                This secure link stays active until{' '}
                {booking.manageTokenExpiresAt ? dateTimeLabel(booking.manageTokenExpiresAt, availabilityTimeZone) : 'the configured expiry time'}.
              </p>
            </div>
          </aside>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default BookingManage;
