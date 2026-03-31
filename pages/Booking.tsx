import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Lock, Sparkles, X } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { ApiError, apiRequest } from '../lib/apiClient';
import { defaultServicesPageContent } from '../lib/cmsDefaults';
import { adaptServicesContent } from '../lib/contentAdapter';
import { getAddOnOfferings, getOfferingById, getPrimaryOfferings, groupOfferingsByCategory } from '../lib/serviceCatalog';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';
import { getTimeZoneDateKey, shiftTimeZoneDateKey, zonedDateTimeToUtc } from '../lib/timeZone';
import { useCmsPage } from '../hooks/useCmsPage';
import type { ServiceOffering } from '../types/cms';

type Step = 1 | 2 | 3;
type Errors = Record<string, string>;
type UploadedAsset = { path: string; bucket: string; originalFilename: string; contentType: string; sizeBytes: number };
type AvailabilitySlot = {
  startAt: string;
  endAt: string;
  label: string;
  status: 'available' | 'full';
  message?: string;
};
type AvailabilityResponse = { timeZone: string; slots: AvailabilitySlot[] };
type BookingResponse = {
  bookingReference: string;
  bookingMode: 'instant' | 'request';
  status: 'confirmed' | 'requested';
  scheduledAt?: string | null;
  manageUrl: string;
  customerEmailStatus: 'sent' | 'failed';
};

const dateFmtKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .replaceAll('/', '-');

const dateFmtLabel = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(date);

const dateFmtWeekday = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);

const dateFmtDay = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(date);

const dateFmtMonth = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' }).format(date);

const dateTimeLabel = (value: string | null | undefined, timeZone: string) => {
  if (!value) return 'Not selected yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not selected yet';
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

const stepLabels = ['Your Vehicle', 'Schedule', 'Confirm & Book'] as const;

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  required?: boolean;
  textarea?: boolean;
}> = ({ label, value, onChange, placeholder = '', type = 'text', error, required, textarea = false }) => (
  <label className="block">
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{label}</span>
      {required && <span className="text-brand-mclaren text-[11px]">*</span>}
    </div>
    {textarea ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`field-underline w-full resize-none min-h-[100px] ${error ? 'field-error' : ''}`}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`field-underline w-full ${error ? 'field-error' : ''}`}
      />
    )}
    {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
  </label>
);

const Booking: React.FC = () => {
  const location = useLocation();
  const { data: servicesCmsData } = useCmsPage('services', defaultServicesPageContent);
  const servicesContent = useMemo(() => adaptServicesContent(servicesCmsData), [servicesCmsData]);
  const primaryOfferings = useMemo(() => getPrimaryOfferings(servicesContent), [servicesContent]);
  const grouped = useMemo(() => groupOfferingsByCategory(primaryOfferings), [primaryOfferings]);
  const addOnOfferings = useMemo(() => getAddOnOfferings(servicesContent), [servicesContent]);
  const vehicleOptions = useMemo(
    () => [...new Set([...servicesContent.detailingPackages.map((item) => item.vehicleType), 'Other / not sure'])],
    [servicesContent.detailingPackages]
  );
  const vehicleMap = useMemo(() => {
    const map = new Map<string, string>();
    servicesContent.detailingPackages.forEach((row) => {
      map.set(row.fullDetailId, row.vehicleType);
      map.set(row.interiorOnlyId, row.vehicleType);
    });
    return map;
  }, [servicesContent.detailingPackages]);

  const [step, setStep] = useState<Step>(1);
  const [vehicleType, setVehicleType] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [availabilityTimeZone, setAvailabilityTimeZone] = useState('America/Toronto');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [backupDate, setBackupDate] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupRequested, setPickupRequested] = useState(false);
  const [pickupAddress, setPickupAddress] = useState({ addressLine1: '', city: '', province: '', postalCode: '', notes: '' });
  const [contact, setContact] = useState({ fullName: '', email: '', phone: '', vehicleMake: '', vehicleModel: '', vehicleYear: '', vehicleDescription: '' });
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BookingResponse | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const dateStripRef = useRef<HTMLDivElement>(null);

  const selectedService = useMemo(() => getOfferingById(servicesContent, serviceId), [serviceId, servicesContent]);
  const selectedAddOns = useMemo(
    () => addOnIds.map((id) => getOfferingById(servicesContent, id)).filter((item): item is ServiceOffering => Boolean(item)),
    [addOnIds, servicesContent]
  );
  const visibleGroups = useMemo(
    () =>
      grouped
        .map((group) => ({
          ...group,
          offerings: group.offerings.filter((service) => {
            const mapped = vehicleMap.get(service.id);
            if (!mapped || !vehicleType || vehicleType === 'Other / not sure') return true;
            return mapped === vehicleType;
          }),
        }))
        .filter((group) => group.offerings.length),
    [grouped, vehicleMap, vehicleType]
  );
  const dateOptions = useMemo(() => nextDates(16, availabilityTimeZone), [availabilityTimeZone]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefilledService = params.get('service');
    if (prefilledService && primaryOfferings.some((service) => service.id === prefilledService)) {
      setServiceId(prefilledService);
      const hint = vehicleMap.get(prefilledService);
      if (hint) {
        setVehicleType(hint);
        setStep(2);
      }
    }
  }, [location.search, primaryOfferings, vehicleMap]);

  useEffect(() => {
    setAddOnIds((current) =>
      current.filter((addOnId) => addOnOfferings.some((addOn) => addOn.id === addOnId))
    );
  }, [addOnOfferings]);

  useEffect(() => {
    if (!selectedService || selectedService.bookingMode !== 'instant' || !selectedDate) {
      setSlots([]);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setAvailabilityError('');
    apiRequest<AvailabilityResponse>(
      `/api/booking/availability?serviceId=${encodeURIComponent(selectedService.id)}&date=${encodeURIComponent(selectedDate)}${
        addOnIds.length ? `&addOnIds=${encodeURIComponent(addOnIds.join(','))}` : ''
      }`
    )
      .then((response) => {
        if (!active) return;
        setAvailabilityTimeZone(response.timeZone || 'America/Toronto');
        setSlots(response.slots);
      })
      .catch((error) => {
        if (!active) return;
        setSlots([]);
        setAvailabilityError(error instanceof ApiError ? error.message : 'Failed to load availability');
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => { active = false; };
  }, [addOnIds, selectedDate, selectedService]);

  useEffect(() => { setSelectedSlot(''); }, [selectedDate]);

  useEffect(() => {
    if (!selectedSlot) return;
    if (!slots.some((slot) => slot.startAt === selectedSlot && slot.status === 'available')) {
      setSelectedSlot('');
    }
  }, [selectedSlot, slots]);

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const validate = (target: Step) => {
    const next: Errors = {};
    if (target >= 1) {
      if (!vehicleType) next.vehicleType = 'Choose the vehicle profile.';
      if (!selectedService) next.service = 'Select a service.';
    }
    if (target >= 2 && selectedService) {
      if (selectedService.bookingMode === 'instant') {
        if (!selectedDate) next.selectedDate = 'Choose a day.';
        if (!selectedSlot) next.selectedSlot = 'Choose an available slot.';
      } else {
        if (!preferredDate) next.preferredDate = 'Choose the preferred date.';
        if (!timeWindow) next.timeWindow = 'Choose the preferred time window.';
        if (!issueDetails.trim()) next.issueDetails = 'Describe the issue or assessment goal.';
      }
    }
    if (target >= 3) {
      if (!contact.fullName.trim()) next.fullName = 'Enter the full name.';
      if (!contact.email.trim()) next.email = 'Enter the email address.';
      if (!contact.phone.trim()) next.phone = 'Enter the phone number.';
      if (pickupRequested && selectedService?.allowsPickupRequest) {
        if (!pickupAddress.addressLine1.trim()) next.pickupAddressLine1 = 'Enter the pickup address.';
        if (!pickupAddress.city.trim()) next.pickupCity = 'Enter the city.';
        if (!pickupAddress.province.trim()) next.pickupProvince = 'Enter the province.';
        if (!pickupAddress.postalCode.trim()) next.pickupPostalCode = 'Enter the postal code.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setUploadError('Photo uploads are unavailable because Supabase is not configured in the browser.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const next: UploadedAsset[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const uploadConfig = await apiRequest<{ bucket: string; path: string; token: string }>('/api/bookings/upload-url', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
        });
        const result = await supabase.storage.from(uploadConfig.bucket).uploadToSignedUrl(uploadConfig.path, uploadConfig.token, file);
        if (result.error) throw new Error(result.error.message);
        next.push({ bucket: uploadConfig.bucket, path: uploadConfig.path, originalFilename: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size });
      }
      setAssets((current) => [...current, ...next]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!selectedService || !validate(3)) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await apiRequest<BookingResponse>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedService.id,
          addOnIds,
          vehicleType,
          vehicleMake: contact.vehicleMake || undefined,
          vehicleModel: contact.vehicleModel || undefined,
          vehicleYear: contact.vehicleYear ? Number(contact.vehicleYear) : undefined,
          vehicleDescription: contact.vehicleDescription || undefined,
          scheduledAt: selectedService.bookingMode === 'instant' ? selectedSlot : undefined,
          preferredDate: selectedService.bookingMode === 'request' ? preferredDate : undefined,
          preferredDateTo: selectedService.bookingMode === 'request' ? backupDate : undefined,
          preferredTimeWindow: selectedService.bookingMode === 'request' ? timeWindow : undefined,
          issueDetails: issueDetails || undefined,
          notes: notes || undefined,
          pickupRequested: selectedService.allowsPickupRequest ? pickupRequested : false,
          pickupAddress: pickupRequested ? pickupAddress : undefined,
          assets,
          contact: { fullName: contact.fullName, email: contact.email, phone: contact.phone },
        }),
      });
      setSubmission(response);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Failed to submit booking');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollDateStrip = (dir: 'left' | 'right') => {
    dateStripRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  /* ── Success Screen ──────────────────────────────────────────────── */

  if (submission && selectedService) {
    return (
      <div className="min-h-screen bg-brand-black text-white relative overflow-hidden flex flex-col items-center justify-center px-4 py-16">
        <div className="success-bloom" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-xl">
          <div className="success-check flex h-20 w-20 items-center justify-center rounded-full bg-brand-mclaren">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <p className="success-reveal success-reveal-1 mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-mclaren">
            {submission.bookingMode === 'instant' ? 'Booking confirmed' : 'Request received'}
          </p>
          <h1 className="success-reveal success-reveal-2 mt-4 font-display text-4xl md:text-5xl font-semibold uppercase leading-tight">
            {submission.bookingMode === 'instant' ? 'You\'re on the calendar.' : 'Request is in motion.'}
          </h1>
          <p className="success-reveal success-reveal-2 mt-4 text-base leading-7 text-white/60 max-w-md">
            {submission.bookingMode === 'instant'
              ? `${selectedService.title} is booked for ${dateTimeLabel(submission.scheduledAt, availabilityTimeZone)}.`
              : 'The team will review your request and follow up within 1 business day.'}
          </p>
          <div className="success-reveal success-reveal-3 mt-10 text-shimmer font-display text-5xl md:text-6xl font-bold uppercase tracking-tight">
            {submission.bookingReference}
          </div>
          <p className="success-reveal success-reveal-3 mt-2 text-xs text-white/40 uppercase tracking-wider">Booking Reference</p>
          <div className="success-reveal success-reveal-4 mt-10 flex flex-col sm:flex-row items-center gap-4">
            <a
              href={submission.manageUrl}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-white/10 transition-colors"
            >
              Manage your booking
            </a>
            <p className="text-xs text-white/40">
              Email: {submission.customerEmailStatus === 'sent' ? 'confirmation sent' : 'delivery pending'}
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-16 w-full max-w-xl">
          <ServiceNotice />
        </div>
      </div>
    );
  }

  /* ── Main Booking Flow ───────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#fafafa] relative">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(255,122,0,0.05),transparent_70%)] z-0" />

      {/* ── Progress Bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-black/[0.04] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            {stepLabels.map((label, i) => {
              const num = (i + 1) as Step;
              const isActive = step === num;
              const isDone = step > num;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (isDone) setStep(num);
                  }}
                  className={`flex items-center gap-2 text-left transition-colors ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                      isDone
                        ? 'bg-brand-mclaren text-white'
                        : isActive
                          ? 'border-2 border-brand-mclaren text-brand-mclaren'
                          : 'border border-neutral-200 text-neutral-300'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
                  </span>
                  <span
                    className={`hidden sm:block text-sm transition-colors ${
                      isActive ? 'font-semibold text-brand-black' : isDone ? 'font-medium text-neutral-600' : 'text-neutral-300'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-[3px] rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-mclaren transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Step Content ─────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-36 pt-10">
        <div key={step} className="step-enter">

          {/* ── Step 1: Vehicle + Service ───────────────────────── */}
          {step === 1 && (
            <>
              <div className="mb-10">
                <h1 className="font-display text-3xl md:text-4xl font-semibold uppercase leading-tight text-brand-black">
                  Choose your service
                </h1>
                <p className="mt-3 text-base text-neutral-500 leading-relaxed">
                  Select your vehicle type, pick a service, and add any extras.
                </p>
              </div>

              {/* Vehicle pills */}
              <div className="mb-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 mb-3">Vehicle type</p>
                <div className="flex flex-wrap gap-2">
                  {vehicleOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => { setVehicleType(option); clearError('vehicleType'); }}
                      className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                        vehicleType === option
                          ? 'bg-brand-black text-white shadow-md pill-pop'
                          : 'border border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-brand-black'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {errors.vehicleType && <p className="mt-2 text-xs text-red-500">{errors.vehicleType}</p>}
              </div>

              {/* Service cards */}
              {visibleGroups.map((group) => (
                <div key={group.category} className="mb-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren mb-4">{group.label}</p>
                  <div className="space-y-3">
                    {group.offerings.map((service) => {
                      const active = serviceId === service.id;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            setServiceId(service.id);
                            if (!service.allowsPickupRequest) setPickupRequested(false);
                            clearError('service');
                          }}
                          className={`group w-full flex items-stretch rounded-2xl border text-left transition-all duration-300 overflow-hidden ${
                            active
                              ? 'border-brand-mclaren ring-2 ring-brand-mclaren/20 bg-white shadow-[0_8px_40px_-12px_rgba(255,122,0,0.12)]'
                              : 'border-neutral-100 bg-white hover:border-neutral-200 hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)]'
                          }`}
                        >
                          <div className="relative w-28 md:w-36 shrink-0 overflow-hidden">
                            <img src={service.image} alt={service.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            {active && <div className="absolute inset-0 bg-brand-mclaren/10" />}
                          </div>
                          <div className="flex-1 p-4 md:p-5 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                service.bookingMode === 'instant'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-amber-50 text-amber-600'
                              }`}>
                                {service.bookingMode === 'instant' ? 'Instant' : 'Review'}
                              </span>
                              {active && <CheckCircle2 className="h-4 w-4 text-brand-mclaren" />}
                            </div>
                            <h3 className="font-display text-lg md:text-xl font-semibold uppercase text-brand-black leading-snug">
                              {service.title}
                            </h3>
                            <p className="mt-1 text-sm text-neutral-500 line-clamp-2 leading-relaxed">{service.description}</p>
                            <div className="mt-3 flex items-center gap-4">
                              <span className="text-sm font-semibold text-brand-mclaren">{service.priceLabel}</span>
                              <span className="text-xs text-neutral-400">{service.duration || 'Timing after review'}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {errors.service && <p className="text-xs text-red-500 mb-4">{errors.service}</p>}

              {/* Add-on chips */}
              {!!addOnOfferings.length && selectedService && (
                <div className="mb-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren mb-1.5">Optional add-ons</p>
                  <p className="text-sm text-neutral-500 mb-4">Extends appointment length automatically.</p>
                  <div className="flex flex-wrap gap-2">
                    {addOnOfferings.map((addOn) => {
                      const active = addOnIds.includes(addOn.id);
                      return (
                        <button
                          key={addOn.id}
                          type="button"
                          onClick={() =>
                            setAddOnIds((current) =>
                              current.includes(addOn.id) ? current.filter((item) => item !== addOn.id) : [...current, addOn.id]
                            )
                          }
                          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                            active
                              ? 'bg-brand-black text-white shadow-md pill-pop'
                              : 'border border-neutral-200 text-neutral-600 hover:border-neutral-400'
                          }`}
                        >
                          {active && <CheckCircle2 className="h-3.5 w-3.5 text-brand-mclaren" />}
                          <span>{addOn.title}</span>
                          <span className="text-xs opacity-60">{addOn.priceLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => validate(1) && setStep(2)} icon>Continue to scheduling</Button>
              </div>
            </>
          )}

          {/* ── Step 2: Schedule ────────────────────────────────── */}
          {step === 2 && selectedService && (
            <>
              <div className="mb-10">
                <h1 className="font-display text-3xl md:text-4xl font-semibold uppercase leading-tight text-brand-black">
                  {selectedService.bookingMode === 'instant' ? 'Pick your slot' : 'Preferred timing'}
                </h1>
                <p className="mt-3 text-base text-neutral-500 leading-relaxed">
                  {selectedService.bookingMode === 'instant'
                    ? 'Choose a date and time that works for you.'
                    : 'Share your preferred dates and we\'ll confirm availability.'}
                </p>
              </div>

              {selectedService.bookingMode === 'instant' ? (
                <>
                  {/* Date strip */}
                  <div className="mb-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 mb-4">Select a date</p>
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
                              onClick={() => { setSelectedDate(key); clearError('selectedDate'); }}
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
                    {errors.selectedDate && <p className="mt-3 text-xs text-red-500">{errors.selectedDate}</p>}
                  </div>

                  {/* Time slots */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Available slots</p>
                        <p className="text-xs text-neutral-400 mt-1">All times shown in Toronto time</p>
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
                              onClick={() => {
                                if (!isFull) { setSelectedSlot(slot.startAt); clearError('selectedSlot'); }
                              }}
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
                              {isFull && slot.message && (
                                <p className="mt-1 text-xs text-neutral-300">{slot.message}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-10 text-center text-sm text-neutral-400">
                        {selectedDate ? 'No slots available for this date.' : 'Select a date to see available times.'}
                      </div>
                    )}
                    {errors.selectedSlot && <p className="mt-3 text-xs text-red-500">{errors.selectedSlot}</p>}
                  </div>
                </>
              ) : (
                /* ── Request mode ────────────────────────────────── */
                <>
                  <div className="grid gap-6 md:grid-cols-2 mb-8">
                    <Field label="Preferred date" type="date" value={preferredDate} onChange={(v) => { setPreferredDate(v); clearError('preferredDate'); }} error={errors.preferredDate} required />
                    <Field label="Backup date" type="date" value={backupDate} onChange={setBackupDate} />
                  </div>

                  <div className="mb-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 mb-3">Time window</p>
                    <div className="flex flex-wrap gap-2">
                      {['Morning (8 AM - 11 AM)', 'Midday (11 AM - 2 PM)', 'Afternoon (2 PM - 5 PM)', 'Any time that day'].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => { setTimeWindow(w); clearError('timeWindow'); }}
                          className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                            timeWindow === w
                              ? 'bg-brand-black text-white shadow-md pill-pop'
                              : 'border border-neutral-200 text-neutral-600 hover:border-neutral-400'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                    {errors.timeWindow && <p className="mt-2 text-xs text-red-500">{errors.timeWindow}</p>}
                  </div>

                  <div className="space-y-6 mb-8">
                    <Field label="Issue details" value={issueDetails} onChange={(v) => { setIssueDetails(v); clearError('issueDetails'); }} placeholder="Tell us what needs to be assessed." textarea error={errors.issueDetails} required />
                    <Field label="Extra notes" value={notes} onChange={setNotes} placeholder="Anything else we should know?" textarea />
                  </div>

                  {selectedService.intakeMode === 'assessment' && (
                    <div className="mb-8 rounded-2xl border border-neutral-100 bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">Optional photos</p>
                          <p className="mt-1 text-sm text-neutral-500">Upload inspection photos for faster review.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand-black px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-neutral-800 transition-colors">
                          <ImagePlus className="h-4 w-4 text-brand-mclaren" />
                          {uploading ? 'Uploading...' : 'Add photos'}
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void uploadFiles(e.target.files)} />
                        </label>
                      </div>
                      {uploadError && <p className="mt-3 text-xs text-red-500">{uploadError}</p>}
                      {!!assets.length && (
                        <div className="mt-4 space-y-2">
                          {assets.map((asset) => (
                            <div key={asset.path} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-brand-black">{asset.originalFilename}</p>
                                <p className="text-xs text-neutral-400">{Math.round(asset.sizeBytes / 1024)} KB</p>
                              </div>
                              <button type="button" onClick={() => setAssets((c) => c.filter((item) => item.path !== asset.path))} className="rounded-full p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between pt-4">
                <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-neutral-400 hover:text-brand-black transition-colors">
                  Back
                </button>
                <Button onClick={() => validate(2) && setStep(3)} icon>Continue</Button>
              </div>
            </>
          )}

          {/* ── Step 3: Contact + Confirm ───────────────────────── */}
          {step === 3 && selectedService && (
            <>
              <div className="mb-10">
                <h1 className="font-display text-3xl md:text-4xl font-semibold uppercase leading-tight text-brand-black">
                  Confirm your details
                </h1>
                <p className="mt-3 text-base text-neutral-500 leading-relaxed">
                  Almost there. Fill in your contact and vehicle information.
                </p>
              </div>

              {/* About You */}
              <div className="mb-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren mb-6">About you</p>
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Full name" value={contact.fullName} onChange={(v) => { setContact((c) => ({ ...c, fullName: v })); clearError('fullName'); }} placeholder="John Doe" error={errors.fullName} required />
                  <Field label="Email address" type="email" value={contact.email} onChange={(v) => { setContact((c) => ({ ...c, email: v })); clearError('email'); }} placeholder="you@example.com" error={errors.email} required />
                  <Field label="Phone number" value={contact.phone} onChange={(v) => { setContact((c) => ({ ...c, phone: v })); clearError('phone'); }} placeholder="+1 (555) 000-0000" error={errors.phone} required />
                </div>
              </div>

              {/* Your Vehicle */}
              <div className="mb-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren mb-6">Your vehicle</p>
                <div className="grid gap-6 md:grid-cols-3">
                  <Field label="Year" value={contact.vehicleYear} onChange={(v) => setContact((c) => ({ ...c, vehicleYear: v }))} placeholder="2021" />
                  <Field label="Make" value={contact.vehicleMake} onChange={(v) => setContact((c) => ({ ...c, vehicleMake: v }))} placeholder="Tesla" />
                  <Field label="Model" value={contact.vehicleModel} onChange={(v) => setContact((c) => ({ ...c, vehicleModel: v }))} placeholder="Model Y" />
                </div>
                <div className="mt-6">
                  <Field label="Vehicle description" value={contact.vehicleDescription} onChange={(v) => setContact((c) => ({ ...c, vehicleDescription: v }))} placeholder="Color, trim, access notes, or anything helpful." textarea />
                </div>
              </div>

              {/* Pickup */}
              {selectedService.allowsPickupRequest && (
                <div className="mb-10 rounded-2xl border border-neutral-100 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">Pickup & drop-off</p>
                      <p className="mt-1 text-sm text-neutral-500">Reviewed manually after your booking is submitted.</p>
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
                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                      <Field label="Address" value={pickupAddress.addressLine1} onChange={(v) => { setPickupAddress((c) => ({ ...c, addressLine1: v })); clearError('pickupAddressLine1'); }} placeholder="123 Main St" error={errors.pickupAddressLine1} required />
                      <Field label="City" value={pickupAddress.city} onChange={(v) => { setPickupAddress((c) => ({ ...c, city: v })); clearError('pickupCity'); }} placeholder="Aurora" error={errors.pickupCity} required />
                      <Field label="Province" value={pickupAddress.province} onChange={(v) => { setPickupAddress((c) => ({ ...c, province: v })); clearError('pickupProvince'); }} placeholder="Ontario" error={errors.pickupProvince} required />
                      <Field label="Postal code" value={pickupAddress.postalCode} onChange={(v) => { setPickupAddress((c) => ({ ...c, postalCode: v })); clearError('pickupPostalCode'); }} placeholder="A1A 1A1" error={errors.pickupPostalCode} required />
                      <Field label="Access notes" value={pickupAddress.notes} onChange={(v) => setPickupAddress((c) => ({ ...c, notes: v }))} placeholder="Gate code, parking instructions" />
                    </div>
                  )}
                </div>
              )}

              {submitError && <p className="text-sm text-red-500 mb-4">{submitError}</p>}

              {/* CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="booking-cta w-full rounded-full bg-brand-mclaren py-4 text-[14px] font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 hover:bg-[#E86E00] hover:shadow-[0_12px_40px_-8px_rgba(255,122,0,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? 'Submitting...'
                    : selectedService.bookingMode === 'instant'
                      ? 'Confirm Booking'
                      : 'Submit Request'}
                </button>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Lock className="h-3.5 w-3.5 text-neutral-300" />
                  <p className="text-xs text-neutral-400">Secure booking &mdash; no payment required now</p>
                </div>
              </div>

              <div className="mt-8 flex items-center">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-medium text-neutral-400 hover:text-brand-black transition-colors">
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Floating Action Bar ────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-black/[0.06] bg-white/90 backdrop-blur-xl shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            {selectedService ? (
              <>
                <p className="text-sm font-semibold text-brand-black truncate">{selectedService.title}</p>
                <p className="text-xs text-neutral-500">{selectedService.priceLabel}{selectedAddOns.length > 0 && ` + ${selectedAddOns.length} add-on${selectedAddOns.length > 1 ? 's' : ''}`}</p>
              </>
            ) : (
              <p className="text-sm text-neutral-400">Select a service to continue</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedService && (
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                className="rounded-full px-3 py-2 text-xs font-medium text-neutral-500 hover:text-brand-mclaren transition-colors"
              >
                Summary
              </button>
            )}
            {step === 1 && (
              <button
                type="button"
                onClick={() => validate(1) && setStep(2)}
                disabled={!selectedService}
                className="group inline-flex items-center gap-1.5 rounded-full bg-brand-mclaren px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-[#E86E00] hover:shadow-[0_8px_30px_-6px_rgba(255,122,0,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => validate(2) && setStep(3)}
                className="group inline-flex items-center gap-1.5 rounded-full bg-brand-mclaren px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-[#E86E00] hover:shadow-[0_8px_30px_-6px_rgba(255,122,0,0.4)]"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            {step === 3 && selectedService && (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="booking-cta inline-flex items-center gap-1.5 rounded-full bg-brand-mclaren px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-[#E86E00] hover:shadow-[0_8px_30px_-6px_rgba(255,122,0,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : selectedService.bookingMode === 'instant' ? 'Confirm' : 'Submit'}
              </button>
            )}
          </div>
        </div>
      </div>

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
              <h2 className="mt-2 font-display text-2xl font-semibold uppercase">{selectedService?.title || 'Your booking'}</h2>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Vehicle</p>
                  <p className="text-sm font-medium">{vehicleType || 'Not selected'}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Service</p>
                  <p className="text-sm font-medium">{selectedService?.title || 'Not selected'}</p>
                  {selectedService && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mclaren">
                        {selectedService.bookingMode === 'instant' ? 'Instant' : 'Review'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                        {selectedService.priceLabel}
                      </span>
                    </div>
                  )}
                  {selectedAddOns.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedAddOns.map((a) => (
                        <span key={a.id} className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                          + {a.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Timing</p>
                  <p className="text-sm font-medium">
                    {selectedService?.bookingMode === 'instant'
                      ? dateTimeLabel(selectedSlot, availabilityTimeZone)
                      : preferredDate
                        ? `${preferredDate}${timeWindow ? ` | ${timeWindow}` : ''}`
                        : 'Still open'}
                  </p>
                  {backupDate && <p className="mt-1 text-xs text-white/40">Backup: {backupDate}</p>}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Contact</p>
                  <p className="text-sm font-medium">{contact.fullName || 'Not entered'}</p>
                  {contact.email && <p className="text-xs text-white/50 mt-0.5">{contact.email}</p>}
                  {contact.phone && <p className="text-xs text-white/50 mt-0.5">{contact.phone}</p>}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-brand-mclaren/20 bg-brand-mclaren/10 p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mclaren mb-2">
                  {selectedService?.bookingMode === 'instant' ? <CalendarDays className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  What happens next
                </p>
                <p className="text-sm leading-relaxed text-white/60">
                  {selectedService?.bookingMode === 'instant'
                    ? 'The selected slot is rechecked before confirmation. You\'ll receive a secure manage link by email.'
                    : 'Your request lands in the queue with all details. The team follows up within 1 business day.'}
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

export default Booking;
