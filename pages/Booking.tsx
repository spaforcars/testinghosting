import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ImagePlus, LoaderCircle, Sparkles, X } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { ApiError, apiRequest } from '../lib/apiClient';
import { defaultServicesPageContent } from '../lib/cmsDefaults';
import { adaptServicesContent } from '../lib/contentAdapter';
import { getAddOnOfferings, getOfferingById, getPrimaryOfferings, groupOfferingsByCategory } from '../lib/serviceCatalog';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';
import { useCmsPage } from '../hooks/useCmsPage';
import type { ServiceOffering } from '../types/cms';

type Step = 1 | 2 | 3;
type Errors = Record<string, string>;
type UploadedAsset = { path: string; bucket: string; originalFilename: string; contentType: string; sizeBytes: number };
type AvailabilityResponse = { timeZone: string; slots: Array<{ startAt: string; endAt: string; label: string }> };
type BookingResponse = {
  bookingReference: string;
  bookingMode: 'instant' | 'request';
  status: 'confirmed' | 'requested';
  scheduledAt?: string | null;
  manageUrl: string;
  customerEmailStatus: 'sent' | 'failed';
};

const dateKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .replaceAll('/', '-');

const dateLabel = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(date);

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
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (dates.length < count) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(cursor);
    if (weekday !== 'Sun') dates.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
};

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
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</span>
      {required && <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">Required</span>}
    </div>
    {textarea ? (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-32 w-full resize-none rounded-[20px] border bg-[#f7f4ee] px-4 py-3 text-base text-brand-black outline-none ${error ? 'border-red-400' : 'border-black/[0.08]'}`}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-[20px] border bg-[#f7f4ee] px-4 py-3 text-base text-brand-black outline-none ${error ? 'border-red-400' : 'border-black/[0.08]'}`}
      />
    )}
    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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
  const [slots, setSlots] = useState<Array<{ startAt: string; endAt: string; label: string }>>([]);
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
    return () => {
      active = false;
    };
  }, [addOnIds, selectedDate, selectedService]);

  useEffect(() => {
    setSelectedSlot('');
  }, [selectedDate]);

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

  if (submission && selectedService) {
    return (
      <div className="min-h-screen bg-[#f2eee6] px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-[36px] bg-brand-black text-white shadow-[0_40px_120px_-60px_rgba(0,0,0,0.85)]">
          <div className="bg-[radial-gradient(circle_at_top,rgba(255,122,0,0.32),transparent_40%)] px-6 py-14 text-center md:px-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-mclaren">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
              {submission.bookingMode === 'instant' ? 'Booking confirmed' : 'Request received'}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold uppercase">
              {submission.bookingMode === 'instant' ? 'You are on the calendar.' : 'The request is in motion.'}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/72">
              {submission.bookingMode === 'instant'
                ? `${selectedService.title} is booked for ${dateTimeLabel(submission.scheduledAt, availabilityTimeZone)}.`
                : 'The team will review the request and follow up within 1 business day.'}
            </p>
          </div>
          <div className="grid gap-4 px-6 pb-10 md:grid-cols-2 md:px-12">
            <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Booking reference</p>
              <p className="mt-2 font-display text-2xl font-semibold">{submission.bookingReference}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Service</p>
              <p className="mt-2 text-lg font-medium">{selectedService.title}</p>
              <p className="mt-3 text-sm text-white/65">Customer email: {submission.customerEmailStatus === 'sent' ? 'sent' : 'delivery pending'}</p>
            </div>
            <a href={submission.manageUrl} className="inline-flex items-center justify-center rounded-full bg-brand-mclaren px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white">
              Manage booking
            </a>
          </div>
        </div>
        <ServiceNotice />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2eee6]">
      <section className="bg-brand-black px-4 pb-16 pt-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-mclaren/25 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
              Hybrid Booking Experience
            </p>
            <h1 className="mt-6 font-display text-5xl font-semibold uppercase leading-[0.95] md:text-7xl">
              Real slots.
              <span className="block text-brand-mclaren">Clear next steps.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72">
              Instant services check real availability. Assessment-heavy services collect timing preferences, issue details, and optional photos instead of promising a fake appointment.
            </p>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-white/8 p-6">
            <div className="grid gap-3">
              {['Vehicle + service', selectedService?.bookingMode === 'request' ? 'Preferred timing + intake' : 'Availability', 'Contact + review'].map((label, index) => (
                <div key={label} className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/6 px-4 py-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${step > index + 1 ? 'bg-brand-mclaren text-white' : step === index + 1 ? 'border border-brand-mclaren text-brand-mclaren' : 'bg-white/8 text-white/50'}`}>
                    {step > index + 1 ? <CheckCircle2 className="h-4 w-4" /> : `0${index + 1}`}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Step {index + 1}</p>
                    <p className="font-medium text-white">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[24px] border border-brand-mclaren/20 bg-brand-mclaren/10 p-4 text-sm leading-6 text-white/80">
              Current build: {selectedService ? selectedService.title : 'Select a vehicle profile and service to begin.'}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 rounded-[34px] border border-black/[0.06] bg-white p-6 shadow-[0_30px_90px_-55px_rgba(0,0,0,0.35)] md:p-8">
            {step === 1 && (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {vehicleOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setVehicleType(option);
                        clearError('vehicleType');
                      }}
                      className={`rounded-[20px] border px-4 py-4 text-left transition ${vehicleType === option ? 'border-brand-mclaren bg-brand-black text-white' : 'border-black/[0.08] bg-[#f7f4ee] text-brand-black'}`}
                    >
                      <p className="font-medium">{option}</p>
                    </button>
                  ))}
                </div>
                {errors.vehicleType && <p className="text-sm text-red-600">{errors.vehicleType}</p>}
                {errors.service && <p className="text-sm text-red-600">{errors.service}</p>}

                {visibleGroups.map((group) => (
                  <div key={group.category} className="rounded-[28px] border border-black/[0.06] bg-[#fcfbf8] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">{group.label}</p>
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      {group.offerings.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            setServiceId(service.id);
                            if (!service.allowsPickupRequest) setPickupRequested(false);
                            clearError('service');
                          }}
                          className={`overflow-hidden rounded-[24px] border text-left transition ${serviceId === service.id ? 'border-brand-mclaren bg-brand-black text-white' : 'border-black/[0.08] bg-white text-brand-black'}`}
                        >
                          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_120px]">
                            <div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-brand-mclaren/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">
                                  {service.bookingMode === 'instant' ? 'Instant booking' : 'Needs review'}
                                </span>
                              </div>
                              <h3 className="mt-4 font-display text-2xl font-semibold uppercase">{service.title}</h3>
                              <p className={`mt-3 text-sm leading-6 ${serviceId === service.id ? 'text-white/72' : 'text-neutral-600'}`}>{service.description}</p>
                            </div>
                            <img src={service.image} alt={service.title} className="h-full min-h-[140px] w-full rounded-[20px] object-cover" />
                          </div>
                          <div className={`flex items-center justify-between border-t px-5 py-4 ${serviceId === service.id ? 'border-white/10 bg-white/4' : 'border-black/[0.06] bg-[#f7f4ee]'}`}>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">{service.priceLabel}</p>
                              <p className={`mt-1 text-sm ${serviceId === service.id ? 'text-white/70' : 'text-neutral-500'}`}>{service.duration || 'Timing confirmed after review'}</p>
                            </div>
                            {serviceId === service.id && <CheckCircle2 className="h-5 w-5 text-brand-mclaren" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {!!addOnOfferings.length && selectedService && (
                  <div className="rounded-[28px] border border-black/[0.06] bg-[#fcfbf8] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Optional add-ons</p>
                        <p className="mt-2 text-sm text-neutral-600">
                          Add-ons extend the appointment length automatically when availability is checked.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      {addOnOfferings.map((addOn) => {
                        const active = addOnIds.includes(addOn.id);
                        return (
                          <button
                            key={addOn.id}
                            type="button"
                            onClick={() =>
                              setAddOnIds((current) =>
                                current.includes(addOn.id)
                                  ? current.filter((item) => item !== addOn.id)
                                  : [...current, addOn.id]
                              )
                            }
                            className={`rounded-[22px] border px-4 py-4 text-left transition ${active ? 'border-brand-mclaren bg-brand-black text-white' : 'border-black/[0.08] bg-white text-brand-black'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{addOn.title}</p>
                                <p className={`mt-2 text-sm leading-6 ${active ? 'text-white/70' : 'text-neutral-600'}`}>{addOn.description}</p>
                              </div>
                              {active && <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-brand-mclaren" />}
                            </div>
                            <div className={`mt-4 flex items-center justify-between border-t pt-3 ${active ? 'border-white/10' : 'border-black/[0.06]'}`}>
                              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">{addOn.priceLabel}</span>
                              <span className={`text-sm ${active ? 'text-white/68' : 'text-neutral-500'}`}>{addOn.duration || 'Adds time at booking review'}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => validate(1) && setStep(2)} icon>Continue</Button>
                </div>
              </>
            )}
            {step === 2 && selectedService && (
              <>
                {selectedService.bookingMode === 'instant' ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {dateOptions.map((day) => {
                        const key = dateKey(day, availabilityTimeZone);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setSelectedDate(key);
                              clearError('selectedDate');
                            }}
                            className={`rounded-[20px] border px-4 py-4 text-left ${selectedDate === key ? 'border-brand-mclaren bg-brand-black text-white' : 'border-black/[0.08] bg-[#f7f4ee] text-brand-black'}`}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">Open day</p>
                            <p className="mt-2 font-medium">{dateLabel(day, availabilityTimeZone)}</p>
                          </button>
                        );
                      })}
                    </div>
                    {errors.selectedDate && <p className="text-sm text-red-600">{errors.selectedDate}</p>}

                    <div className="rounded-[28px] bg-brand-black p-6 text-white">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Live slots</p>
                          <p className="mt-2 font-display text-2xl font-semibold uppercase">{selectedDate || 'Pick a day first'}</p>
                        </div>
                        {loadingSlots && <LoaderCircle className="h-5 w-5 animate-spin text-brand-mclaren" />}
                      </div>
                      {availabilityError && <p className="mt-4 text-sm text-red-400">{availabilityError}</p>}
                      {selectedDate && slots.length ? (
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          {slots.map((slot) => (
                            <button
                              key={slot.startAt}
                              type="button"
                              onClick={() => {
                                setSelectedSlot(slot.startAt);
                                clearError('selectedSlot');
                              }}
                              className={`rounded-[20px] border px-4 py-4 text-left ${selectedSlot === slot.startAt ? 'border-brand-mclaren bg-brand-mclaren/12 text-white' : 'border-white/10 bg-white/6 text-white/80'}`}
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">Confirmed slot</p>
                              <p className="mt-2 font-display text-2xl font-semibold uppercase">{slot.label}</p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-[22px] border border-dashed border-white/12 bg-white/6 px-4 py-8 text-center text-sm text-white/60">
                          {selectedDate ? 'No slots are open on that day.' : 'Choose a day to load slots.'}
                        </div>
                      )}
                      {errors.selectedSlot && <p className="mt-4 text-sm text-red-400">{errors.selectedSlot}</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Preferred date" type="date" value={preferredDate} onChange={(value) => { setPreferredDate(value); clearError('preferredDate'); }} error={errors.preferredDate} required />
                      <Field label="Backup date" type="date" value={backupDate} onChange={setBackupDate} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {['Morning (8 AM - 11 AM)', 'Midday (11 AM - 2 PM)', 'Afternoon (2 PM - 5 PM)', 'Any time that day'].map((window) => (
                        <button
                          key={window}
                          type="button"
                          onClick={() => {
                            setTimeWindow(window);
                            clearError('timeWindow');
                          }}
                          className={`rounded-[20px] border px-4 py-4 text-left ${timeWindow === window ? 'border-brand-mclaren bg-brand-black text-white' : 'border-black/[0.08] bg-[#f7f4ee] text-brand-black'}`}
                        >
                          {window}
                        </button>
                      ))}
                    </div>
                    {errors.timeWindow && <p className="text-sm text-red-600">{errors.timeWindow}</p>}
                    <Field label="Issue details" value={issueDetails} onChange={(value) => { setIssueDetails(value); clearError('issueDetails'); }} placeholder="Tell us what needs to be assessed." textarea error={errors.issueDetails} required />
                    <Field label="Extra notes" value={notes} onChange={setNotes} placeholder="Anything else we should know?" textarea />
                    {selectedService.intakeMode === 'assessment' && (
                      <div className="rounded-[28px] border border-black/[0.06] bg-[#f7f4ee] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Optional photos</p>
                            <p className="mt-2 text-sm text-neutral-600">Upload inspection photos for faster review.</p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand-black px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white">
                            <ImagePlus className="h-4 w-4 text-brand-mclaren" />
                            {uploading ? 'Uploading...' : 'Add photos'}
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void uploadFiles(event.target.files)} />
                          </label>
                        </div>
                        {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
                        {!!assets.length && (
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {assets.map((asset) => (
                              <div key={asset.path} className="flex items-center justify-between rounded-[18px] border border-black/[0.08] bg-white px-4 py-3">
                                <div>
                                  <p className="font-medium text-brand-black">{asset.originalFilename}</p>
                                  <p className="text-sm text-neutral-500">{Math.round(asset.sizeBytes / 1024)} KB</p>
                                </div>
                                <button type="button" onClick={() => setAssets((current) => current.filter((item) => item.path !== asset.path))} className="rounded-full border border-black/[0.08] p-2 text-neutral-500">
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
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-neutral-500">Back</button>
                  <Button onClick={() => validate(2) && setStep(3)} icon>Continue</Button>
                </div>
              </>
            )}

            {step === 3 && selectedService && (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Full name" value={contact.fullName} onChange={(value) => { setContact((current) => ({ ...current, fullName: value })); clearError('fullName'); }} placeholder="John Doe" error={errors.fullName} required />
                  <Field label="Email address" type="email" value={contact.email} onChange={(value) => { setContact((current) => ({ ...current, email: value })); clearError('email'); }} placeholder="you@example.com" error={errors.email} required />
                  <Field label="Phone number" value={contact.phone} onChange={(value) => { setContact((current) => ({ ...current, phone: value })); clearError('phone'); }} placeholder="+1 (555) 000-0000" error={errors.phone} required />
                  <Field label="Vehicle year" value={contact.vehicleYear} onChange={(value) => setContact((current) => ({ ...current, vehicleYear: value }))} placeholder="2021" />
                  <Field label="Vehicle make" value={contact.vehicleMake} onChange={(value) => setContact((current) => ({ ...current, vehicleMake: value }))} placeholder="Tesla" />
                  <Field label="Vehicle model" value={contact.vehicleModel} onChange={(value) => setContact((current) => ({ ...current, vehicleModel: value }))} placeholder="Model Y" />
                </div>
                <Field label="Vehicle description" value={contact.vehicleDescription} onChange={(value) => setContact((current) => ({ ...current, vehicleDescription: value }))} placeholder="Color, trim, access notes, or anything helpful." textarea />
                {selectedService.allowsPickupRequest && (
                  <div className="rounded-[28px] bg-brand-black p-6 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Pickup request</p>
                        <p className="mt-2 text-sm text-white/68">Pickup and drop-off is reviewed manually, but the address can be collected now.</p>
                      </div>
                      <button type="button" onClick={() => setPickupRequested((current) => !current)} className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] ${pickupRequested ? 'bg-brand-mclaren text-white' : 'border border-white/12 bg-white/8 text-white/80'}`}>
                        {pickupRequested ? 'Pickup requested' : 'Request pickup'}
                      </button>
                    </div>
                    {pickupRequested && (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <Field label="Address line 1" value={pickupAddress.addressLine1} onChange={(value) => { setPickupAddress((current) => ({ ...current, addressLine1: value })); clearError('pickupAddressLine1'); }} placeholder="123 Main St" error={errors.pickupAddressLine1} required />
                        <Field label="City" value={pickupAddress.city} onChange={(value) => { setPickupAddress((current) => ({ ...current, city: value })); clearError('pickupCity'); }} placeholder="Aurora" error={errors.pickupCity} required />
                        <Field label="Province" value={pickupAddress.province} onChange={(value) => { setPickupAddress((current) => ({ ...current, province: value })); clearError('pickupProvince'); }} placeholder="Ontario" error={errors.pickupProvince} required />
                        <Field label="Postal code" value={pickupAddress.postalCode} onChange={(value) => { setPickupAddress((current) => ({ ...current, postalCode: value })); clearError('pickupPostalCode'); }} placeholder="A1A 1A1" error={errors.pickupPostalCode} required />
                        <Field label="Access notes" value={pickupAddress.notes} onChange={(value) => setPickupAddress((current) => ({ ...current, notes: value }))} placeholder="Gate code, parking instructions" />
                      </div>
                    )}
                  </div>
                )}
                {submitError && <p className="text-sm text-red-600">{submitError}</p>}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setStep(2)} className="text-sm font-medium text-neutral-500">Back</button>
                  <Button onClick={submit} disabled={submitting}>
                    {submitting ? 'Submitting...' : selectedService.bookingMode === 'instant' ? 'Confirm booking' : 'Send request'}
                  </Button>
                </div>
              </>
            )}
          </div>

          <aside className="h-fit rounded-[34px] bg-brand-black p-6 text-white shadow-[0_40px_120px_-60px_rgba(0,0,0,0.85)] lg:sticky lg:top-24">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Booking summary</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">Customer view</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Vehicle profile</p>
                <p className="mt-2 text-base font-medium">{vehicleType || 'Choose a profile'}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Service</p>
                <p className="mt-2 text-base font-medium">{selectedService?.title || 'Choose a service'}</p>
                {selectedService && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">
                      {selectedService.bookingMode === 'instant' ? 'Instant booking' : 'Needs review'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                      {selectedService.priceLabel}
                    </span>
                  </div>
                )}
                {selectedAddOns.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedAddOns.map((addOn) => (
                      <span key={addOn.id} className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                        {addOn.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Timing</p>
                <p className="mt-2 text-base font-medium">
                  {selectedService?.bookingMode === 'instant'
                    ? dateTimeLabel(selectedSlot, availabilityTimeZone)
                    : preferredDate
                      ? `${preferredDate}${timeWindow ? ` | ${timeWindow}` : ''}`
                      : 'Still open'}
                </p>
                {backupDate && <p className="mt-2 text-sm text-white/60">Backup date: {backupDate}</p>}
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Contact</p>
                <p className="mt-2 text-base font-medium">{contact.fullName || 'Customer name'}</p>
                <p className="mt-1 text-sm text-white/60">{contact.email || 'Email address'}</p>
                <p className="mt-1 text-sm text-white/60">{contact.phone || 'Phone number'}</p>
              </div>
            </div>
            <div className="mt-6 rounded-[24px] border border-brand-mclaren/20 bg-brand-mclaren/10 p-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                {selectedService?.bookingMode === 'instant' ? <CalendarDays className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                What happens next
              </p>
              <p className="mt-3 text-sm leading-6 text-white/78">
                {selectedService?.bookingMode === 'instant'
                  ? 'The selected slot is rechecked on the server before it is confirmed, then the customer gets a secure manage link.'
                  : 'The request lands in the lead queue with preferred timing, issue details, pickup preferences, and any uploaded photos.'}
              </p>
            </div>
          </aside>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Booking;
