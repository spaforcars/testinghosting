import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { apiRequest, ApiError } from '../lib/apiClient';
import { useCmsPage } from '../hooks/useCmsPage';
import { defaultServicesPageContent } from '../lib/cmsDefaults';
import { adaptServicesContent } from '../lib/contentAdapter';
import {
  buildServiceLabel,
  getAddOnOfferings,
  getOfferingById,
  getPrimaryOfferings,
  groupOfferingsByCategory,
} from '../lib/serviceCatalog';

const Booking: React.FC = () => {
  const location = useLocation();
  const { data: servicesCmsData } = useCmsPage('services', defaultServicesPageContent);
  const servicesContent = adaptServicesContent(servicesCmsData);

  const primaryOfferings = useMemo(() => getPrimaryOfferings(servicesContent), [servicesContent]);
  const addOnOfferings = useMemo(() => getAddOnOfferings(servicesContent), [servicesContent]);
  const groupedPrimaryOfferings = useMemo(
    () => groupOfferingsByCategory(primaryOfferings),
    [primaryOfferings]
  );

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [details, setDetails] = useState({
    fullName: '',
    email: '',
    phone: '',
    vehicle: '',
    notes: '',
  });

  const selectedService = useMemo(
    () => getOfferingById(servicesContent, selectedServiceId),
    [selectedServiceId, servicesContent]
  );
  const selectedAddOns = useMemo(
    () =>
      selectedAddOnIds
        .map((id) => getOfferingById(servicesContent, id))
        .filter(Boolean),
    [selectedAddOnIds, servicesContent]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const serviceId = params.get('service');
    const addOnId = params.get('addon');

    if (serviceId && primaryOfferings.some((service) => service.id === serviceId)) {
      setSelectedServiceId(serviceId);
    }

    if (addOnId && addOnOfferings.some((service) => service.id === addOnId)) {
      setSelectedAddOnIds((current) => (current.includes(addOnId) ? current : [...current, addOnId]));
    }
  }, [addOnOfferings, location.search, primaryOfferings]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.sr, .stagger').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const timeSlots = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'];

  const formatMonth = (date: Date) =>
    date.toLocaleString('default', { month: 'long', year: 'numeric' });

  const generateDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startDay = firstDayOfMonth(currentMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startDay; i += 1) {
      days.push(<div key={`empty-${i}`} className="h-11 rounded-md bg-transparent" />);
    }

    for (let i = 1; i <= totalDays; i += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      date.setHours(0, 0, 0, 0);

      const isSelected = selectedDate?.toDateString() === date.toDateString();
      const isToday = new Date().toDateString() === date.toDateString();
      const isPast = date < today;

      days.push(
        <button
          key={i}
          disabled={isPast}
          onClick={() => {
            setSelectedDate(date);
            setSelectedTime(null);
          }}
          className={`relative h-11 rounded-lg text-sm font-medium transition-colors ${
            isSelected
              ? 'bg-brand-mclaren text-white'
              : isPast
                ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                : 'border border-black/[0.06] bg-white text-brand-black hover:border-brand-mclaren/50 hover:bg-brand-mclaren/5'
          }`}
        >
          {i}
          {isToday && !isSelected && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-mclaren" />}
        </button>
      );
    }

    return days;
  };

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOnIds((current) =>
      current.includes(addOnId) ? current.filter((id) => id !== addOnId) : [...current, addOnId]
    );
  };

  const handleConfirm = async () => {
    if (!details.fullName || !details.email || !details.phone || !selectedService || !selectedDate || !selectedTime) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: details.fullName,
          email: details.email,
          phone: details.phone,
          message: details.notes || `Booking request for ${details.vehicle || 'vehicle details pending'}`,
          serviceType: buildServiceLabel(selectedService, selectedAddOns, selectedService.title),
          serviceCatalogId: selectedService.id,
          serviceAddonIds: selectedAddOnIds,
          sourcePage: 'booking',
          metadata: {
            selectedDate: selectedDate.toISOString(),
            selectedTime,
            vehicle: details.vehicle,
            selectedServiceId: selectedService.id,
            selectedServiceTitle: selectedService.title,
            selectedAddOnIds,
            selectedAddOnTitles: selectedAddOns.map((service) => service.title),
          },
        }),
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Failed to submit booking request');
    } finally {
      setSubmitting(false);
    }
  };

  const serviceSummary = selectedService
    ? buildServiceLabel(selectedService, selectedAddOns, selectedService.title)
    : 'Not selected yet';

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-black/[0.06] bg-white px-4 py-14 md:py-16">
        <div className="mx-auto max-w-7xl sr">
          <span className="inline-block rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
            Booking
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Reserve Your Appointment
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-600">
            Choose your service, add any optional upgrades when available, then request your preferred date and time.
          </p>
        </div>
      </section>

      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          <aside className="sr h-fit rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] card-hover lg:sticky lg:top-24">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Booking Summary</h2>
            <div className="mt-6 space-y-6">
              <div className={step >= 1 ? 'opacity-100' : 'opacity-50'}>
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">
                  {step > 1 && <CheckCircle2 className="h-4 w-4 text-brand-mclaren" />} Step 1 - Service
                </h3>
                <p className="mt-2 text-sm text-gray-700">{serviceSummary}</p>
                {selectedAddOns.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {selectedAddOns.map((service) => (
                      <div key={service.id} className="text-xs uppercase tracking-[0.08em] text-gray-500">
                        Add-on: {service.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={step >= 2 ? 'opacity-100' : 'opacity-50'}>
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">
                  {step > 2 && <CheckCircle2 className="h-4 w-4 text-brand-mclaren" />} Step 2 - Date & Time
                </h3>
                <p className="mt-2 text-sm text-gray-700">
                  {selectedDate ? `${selectedDate.toLocaleDateString()} at ${selectedTime || 'time pending'}` : 'Not selected yet'}
                </p>
              </div>

              <div className={step >= 3 ? 'opacity-100' : 'opacity-50'}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">Step 3 - Details</h3>
                <p className="mt-2 text-sm text-gray-700">{details.fullName || 'Contact details pending'}</p>
              </div>
            </div>
            <div className="mt-8 border-t border-black/[0.06] pt-5">
              <p className="text-sm text-gray-500">Published pricing</p>
              <p className="font-display text-3xl font-semibold text-brand-black">
                {selectedService?.priceLabel || '$0'}
              </p>
              {selectedAddOns.length > 0 && (
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  {selectedAddOns.map((service) => (
                    <div key={service.id} className="flex items-center justify-between gap-3">
                      <span>{service.shortTitle || service.title}</span>
                      <span>{service.priceLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <div className="lg:col-span-2">
            <div className="sr sr-delay-1 rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-8">
              {submitted ? (
                <div className="animate-fade-in py-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="mt-6 font-display text-3xl font-semibold uppercase text-brand-black">Booking Request Submitted</h2>
                  <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-600">
                    Thanks {details.fullName}. We&apos;ll confirm your appointment for {selectedDate?.toLocaleDateString()} at {selectedTime} shortly by email or phone.
                  </p>
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <div className="animate-fade-in">
                      <div className="mb-6 flex items-end justify-between border-b border-black/[0.06] pb-4">
                        <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">Select Service</h2>
                        <span className="rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                          Step 1 of 3
                        </span>
                      </div>

                      <div className="space-y-6">
                        {groupedPrimaryOfferings.map((group) => (
                          <div key={group.category}>
                            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {group.label}
                            </div>
                            <div className="space-y-3">
                              {group.offerings.map((service) => {
                                const isSelected = selectedService?.id === service.id;
                                return (
                                  <button
                                    key={service.id}
                                    type="button"
                                    onClick={() => setSelectedServiceId(service.id)}
                                    className={`w-full rounded-xl border px-5 py-4 text-left transition-colors ${
                                      isSelected
                                        ? 'border-brand-mclaren bg-brand-mclaren/5'
                                        : 'border-black/[0.06] bg-white hover:border-brand-mclaren/50'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="font-display text-xl font-semibold uppercase text-brand-black">
                                          {service.title}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-600">
                                          {service.duration || 'Duration varies'}
                                        </p>
                                      </div>
                                      <p className="text-lg font-semibold text-brand-black">{service.priceLabel}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {addOnOfferings.length > 0 && (
                          <div className="rounded-2xl border border-black/[0.06] bg-brand-gray/60 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className="font-display text-xl font-semibold uppercase text-brand-black">
                                  Optional Add-Ons
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-gray-600">
                                  Optional upgrades can be attached to the selected service.
                                </p>
                              </div>
                              {!selectedService && (
                                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                  Choose a service first
                                </span>
                              )}
                            </div>
                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                              {addOnOfferings.map((service) => {
                                const checked = selectedAddOnIds.includes(service.id);
                                return (
                                  <label
                                    key={service.id}
                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 transition ${
                                      checked
                                        ? 'border-brand-mclaren bg-brand-mclaren/5'
                                        : 'border-black/[0.06] bg-white'
                                    } ${!selectedService ? 'cursor-not-allowed opacity-60' : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-mclaren focus:ring-brand-mclaren"
                                      checked={checked}
                                      disabled={!selectedService}
                                      onChange={() => toggleAddOn(service.id)}
                                    />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-brand-black">{service.title}</div>
                                      <div className="mt-1 text-sm text-gray-600">{service.priceLabel}</div>
                                      <div className="mt-1 text-xs leading-5 text-gray-500">{service.description}</div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-8 flex justify-end">
                        <Button onClick={() => setStep(2)} disabled={!selectedService} icon>
                          Check Availability
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="animate-fade-in">
                      <div className="mb-6 flex items-end justify-between border-b border-black/[0.06] pb-4">
                        <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">Select Date & Time</h2>
                        <span className="rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                          Step 2 of 3
                        </span>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-[1fr_210px]">
                        <div>
                          <div className="mb-4 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                              className="rounded-md p-2 text-gray-500 transition-colors hover:bg-brand-gray hover:text-brand-black"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <p className="font-semibold uppercase tracking-[0.08em] text-brand-black">{formatMonth(currentMonth)}</p>
                            <button
                              type="button"
                              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                              className="rounded-md p-2 text-gray-500 transition-colors hover:bg-brand-gray hover:text-brand-black"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                              <span key={day}>{day}</span>
                            ))}
                          </div>
                          <div className="mt-2 grid grid-cols-7 gap-2">{generateDays()}</div>
                        </div>

                        <div>
                          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                            <Clock3 className="h-4 w-4" />
                            Available Slots
                          </p>
                          {selectedDate ? (
                            <div className="custom-scrollbar max-h-[290px] space-y-2 overflow-y-auto pr-1">
                              {timeSlots.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setSelectedTime(slot)}
                                  className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
                                    selectedTime === slot
                                      ? 'border-brand-mclaren bg-brand-mclaren/5 font-semibold text-brand-mclaren'
                                      : 'border-black/[0.06] bg-white text-brand-black hover:border-brand-mclaren hover:text-brand-mclaren'
                                  }`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-black/[0.06] bg-brand-gray px-3 py-6 text-center text-sm text-gray-500">
                              Select a date first
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-8 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-brand-black"
                        >
                          <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                        <Button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime}>
                          Continue
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="animate-fade-in">
                      <div className="mb-6 flex items-end justify-between border-b border-black/[0.06] pb-4">
                        <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">Your Details</h2>
                        <span className="rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                          Step 3 of 3
                        </span>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Full Name</label>
                          <input
                            type="text"
                            value={details.fullName}
                            onChange={(event) => setDetails((prev) => ({ ...prev, fullName: event.target.value }))}
                            className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black outline-none transition-shadow focus:border-brand-mclaren focus:ring-2 focus:ring-brand-mclaren/20"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Email Address</label>
                          <input
                            type="email"
                            value={details.email}
                            onChange={(event) => setDetails((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black outline-none transition-shadow focus:border-brand-mclaren focus:ring-2 focus:ring-brand-mclaren/20"
                            placeholder="you@example.com"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Phone Number</label>
                          <input
                            type="tel"
                            value={details.phone}
                            onChange={(event) => setDetails((prev) => ({ ...prev, phone: event.target.value }))}
                            className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black outline-none transition-shadow focus:border-brand-mclaren focus:ring-2 focus:ring-brand-mclaren/20"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Vehicle Details</label>
                          <input
                            type="text"
                            value={details.vehicle}
                            onChange={(event) => setDetails((prev) => ({ ...prev, vehicle: event.target.value }))}
                            className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black outline-none transition-shadow focus:border-brand-mclaren focus:ring-2 focus:ring-brand-mclaren/20"
                            placeholder="Year, Make, Model"
                          />
                        </div>
                      </div>

                      <div className="mt-5">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Special Requests</label>
                        <textarea
                          value={details.notes}
                          onChange={(event) => setDetails((prev) => ({ ...prev, notes: event.target.value }))}
                          className="h-28 w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black outline-none transition-shadow focus:border-brand-mclaren focus:ring-2 focus:ring-brand-mclaren/20"
                          placeholder="Any concerns or goals for this appointment?"
                        />
                      </div>

                      <div className="mt-8 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-brand-black"
                        >
                          <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                        <Button onClick={handleConfirm} disabled={submitting}>
                          {submitting ? 'Submitting...' : 'Confirm Booking'}
                        </Button>
                      </div>
                      {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Booking;
