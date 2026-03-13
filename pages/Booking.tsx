import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Shield,
  Sparkles,
  Star,
} from 'lucide-react';
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
import type { ServiceOffering } from '../types/cms';

const bookingSteps = [
  {
    number: '01',
    title: 'Choose the finish',
    description: 'Pick the package that matches the level of transformation you want.',
  },
  {
    number: '02',
    title: 'Lock the slot',
    description: 'Choose the day and time window that works for your schedule.',
  },
  {
    number: '03',
    title: 'Tell us about the car',
    description: 'Add vehicle details so we can confirm prep, timing, and expectations.',
  },
] as const;

const bookingSignals = [
  {
    icon: Sparkles,
    title: 'Showroom energy',
    description: 'Packages built around visible payoff, not just a long checklist.',
  },
  {
    icon: Shield,
    title: 'Up-front pricing',
    description: 'Published package pricing keeps the booking flow clear and confident.',
  },
  {
    icon: Clock3,
    title: 'Fast follow-up',
    description: 'Your request gets confirmed by phone or email after submission.',
  },
] as const;

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
        .filter((service): service is ServiceOffering => Boolean(service)),
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

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const timeSlots = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'];

  const formatMonth = (date: Date) =>
    date.toLocaleString('default', { month: 'long', year: 'numeric' });

  const formatSelectedDate = (date: Date | null) =>
    date
      ? date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Not selected yet';

  const generateDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startDay = firstDayOfMonth(currentMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startDay; i += 1) {
      days.push(<div key={`empty-${i}`} className="h-12 rounded-2xl bg-transparent" />);
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
          className={`relative h-12 rounded-2xl text-sm font-semibold transition-all duration-300 ${
            isSelected
              ? 'border border-brand-mclaren bg-brand-black text-white shadow-[0_20px_40px_-20px_rgba(255,122,0,0.65)]'
              : isPast
                ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                : 'border border-black/[0.08] bg-white text-brand-black hover:-translate-y-0.5 hover:border-brand-mclaren/50 hover:bg-brand-mclaren/[0.04]'
          }`}
        >
          {i}
          {isToday && !isSelected && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-mclaren" />
          )}
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
    : 'Pick the service that matches the result you want.';
  const heroService = selectedService ?? primaryOfferings[0] ?? null;
  const currentStep = bookingSteps[step - 1];
  const progressWidth = step === 1 ? '33%' : step === 2 ? '66%' : '100%';
  const spotlightFeatures = selectedService?.features.slice(0, 3) ?? [
    'Interior reset',
    'Exterior gloss',
    'Protection options',
  ];

  return (
    <div className="min-h-screen bg-[#f3f1ec]">
      <section className="relative isolate overflow-hidden bg-brand-black px-4 pb-20 pt-16 text-white md:pb-24 md:pt-24">
        {heroService && (
          <img
            src={heroService.image}
            alt={heroService.title}
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,0,0.28),transparent_32%),linear-gradient(115deg,rgba(10,10,10,0.96),rgba(10,10,10,0.8),rgba(10,10,10,0.96))]" />
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-brand-mclaren/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative z-10 animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
              Signature Booking Flow
            </span>
            <h1 className="mt-6 max-w-4xl font-display text-5xl font-bold uppercase leading-[0.9] tracking-tight md:text-7xl">
              Book the
              <span className="block text-brand-mclaren">showroom moment.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
              Choose the transformation, lock the time, and let the appointment feel as premium as
              the finish you are booking.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white/82">
                {primaryOfferings.length} bookable services
              </div>
              <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white/82">
                Published pricing
              </div>
              <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white/82">
                Request takes under 3 minutes
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {bookingSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div
                    key={signal.title}
                    className="rounded-[24px] border border-white/10 bg-white/6 p-5 backdrop-blur-md"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mclaren/16 text-brand-mclaren">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 font-display text-lg font-semibold uppercase text-white">
                      {signal.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/65">{signal.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 animate-fade-in">
            <div className="booking-sheen overflow-hidden rounded-[30px] border border-white/10 bg-white/8 p-5 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.85)] backdrop-blur-xl">
              <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr] lg:grid-cols-1 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="relative overflow-hidden rounded-[24px] bg-white/5">
                  {heroService ? (
                    <>
                      <img
                        src={heroService.image}
                        alt={heroService.title}
                        className="h-full min-h-[260px] w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                          Live preview
                        </p>
                        <p className="mt-2 max-w-xs font-display text-2xl font-semibold uppercase text-white">
                          {heroService.shortTitle || heroService.title}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[260px] items-center justify-center bg-brand-black text-white/70">
                      Service imagery loading
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                      {selectedService ? 'Selected service' : 'Booking spotlight'}
                    </p>
                    <h2 className="mt-3 font-display text-3xl font-semibold uppercase leading-tight text-white">
                      {selectedService ? selectedService.title : 'Make the car feel new again'}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-white/68">
                      {selectedService
                        ? selectedService.description
                        : 'Browse detailing, tint, protection, and specialty services with published pricing and a more guided booking flow.'}
                    </p>
                  </div>

                  <div className="mt-6 space-y-5">
                    <div className="flex flex-wrap gap-2">
                      {spotlightFeatures.map((feature) => (
                        <span
                          key={feature}
                          className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                          Price
                        </p>
                        <p className="mt-2 font-display text-3xl font-semibold text-white">
                          {selectedService?.priceLabel || 'Choose a package'}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                          Duration
                        </p>
                        <p className="mt-2 font-display text-3xl font-semibold text-white">
                          {selectedService?.duration || 'Varies'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-brand-mclaren/20 bg-brand-mclaren/10 p-4 text-sm leading-6 text-white/80">
                      The page now guides the decision instead of dumping a flat list. Select a
                      package to reveal the exact snapshot, pricing, and timing.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="relative z-10 px-4 pb-16 pt-8 md:pb-24 md:pt-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-[30px] bg-[#0f0f10] text-white shadow-[0_40px_120px_-55px_rgba(0,0,0,0.85)] lg:sticky lg:top-24">
            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(255,122,0,0.22),transparent_55%)] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                    Booking summary
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold uppercase text-white">
                    Your build
                  </h2>
                </div>
                <div className="rounded-full border border-brand-mclaren/25 bg-brand-mclaren/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                  Step {step} of 3
                </div>
              </div>

              {heroService && (
                <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8 bg-white/6">
                  <img
                    src={heroService.image}
                    alt={heroService.title}
                    className="h-40 w-full object-cover"
                  />
                  <div className="space-y-2 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Current selection
                    </p>
                    <p className="font-display text-xl font-semibold uppercase text-white">
                      {selectedService?.title || 'Choose a service'}
                    </p>
                    <p className="text-sm leading-6 text-white/65">
                      {selectedService?.description || 'Your service snapshot will update here as soon as you pick a package.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6 p-6">
              <div className="space-y-4">
                {bookingSteps.map((item, index) => {
                  const stepNumber = index + 1;
                  const isActive = stepNumber === step;
                  const isComplete = stepNumber < step;
                  return (
                    <div key={item.number} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                            isComplete
                              ? 'border-brand-mclaren bg-brand-mclaren text-white'
                              : isActive
                                ? 'border-brand-mclaren bg-brand-mclaren/15 text-brand-mclaren'
                                : 'border-white/12 bg-white/6 text-white/50'
                          }`}
                        >
                          {isComplete ? <CheckCircle2 className="h-4 w-4" /> : item.number}
                        </div>
                        {stepNumber !== bookingSteps.length && (
                          <div className="mt-2 h-12 w-px bg-white/10" />
                        )}
                      </div>
                      <div className="pt-1">
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            isActive || isComplete ? 'text-brand-mclaren' : 'text-white/40'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/68">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/6 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Service line-up
                </p>
                <p className="mt-3 text-sm leading-6 text-white/78">{serviceSummary}</p>
                {selectedAddOns.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedAddOns.map((service) => (
                      <span
                        key={service.id}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/74"
                      >
                        + {service.shortTitle || service.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[24px] border border-white/8 bg-white/6 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Date and time
                  </p>
                  <p className="mt-3 text-base font-medium text-white">
                    {selectedDate ? `${formatSelectedDate(selectedDate)}${selectedTime ? ` at ${selectedTime}` : ''}` : 'Still open'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/6 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Published pricing
                  </p>
                  <p className="mt-3 font-display text-3xl font-semibold text-white">
                    {selectedService?.priceLabel || '$0'}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-brand-mclaren/18 bg-brand-mclaren/10 p-5">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                  <Star className="h-4 w-4" />
                  What happens next
                </p>
                <p className="mt-3 text-sm leading-6 text-white/78">
                  Submit the request and the team will confirm timing, vehicle fit, and any prep
                  details before the appointment.
                </p>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_30px_90px_-50px_rgba(0,0,0,0.3)]">
              <div className="border-b border-black/[0.06] bg-[radial-gradient(circle_at_top_right,rgba(255,122,0,0.15),transparent_28%),linear-gradient(180deg,#ffffff,#fbfaf7)] p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                      {currentStep.number} / 03
                    </p>
                    <h2 className="mt-3 font-display text-3xl font-semibold uppercase text-brand-black md:text-4xl">
                      {currentStep.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
                      {currentStep.description}
                    </p>
                  </div>

                  <div className="rounded-full border border-black/[0.08] bg-white/90 px-4 py-2 text-sm font-medium text-neutral-700">
                    {selectedService ? selectedService.shortTitle || selectedService.title : 'Start with a package'}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {bookingSteps.map((item, index) => {
                    const stepNumber = index + 1;
                    const active = stepNumber === step;
                    const complete = stepNumber < step;
                    return (
                      <div
                        key={item.number}
                        className={`rounded-[24px] border p-4 transition-colors ${
                          active
                            ? 'border-brand-mclaren bg-brand-mclaren/[0.07]'
                            : complete
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-black/[0.06] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                            Step {item.number}
                          </span>
                          {complete && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        </div>
                        <p className="mt-3 font-display text-lg font-semibold uppercase text-brand-black">
                          {item.title}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-mclaren via-[#ff9b42] to-brand-black transition-all duration-500"
                    style={{ width: progressWidth }}
                  />
                </div>
              </div>

              <div className="p-6 md:p-8">
                {submitted ? (
                  <div className="animate-fade-in overflow-hidden rounded-[32px] bg-brand-black text-center text-white">
                    <div className="bg-[radial-gradient(circle_at_top,rgba(255,122,0,0.28),transparent_38%)] px-6 py-12">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-mclaren text-white shadow-[0_20px_60px_-20px_rgba(255,122,0,0.8)]">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                      <h2 className="mt-6 font-display text-4xl font-semibold uppercase text-white">
                        Booking request sent
                      </h2>
                      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/72">
                        Thanks {details.fullName}. We will confirm your appointment for{' '}
                        {selectedDate ? formatSelectedDate(selectedDate) : 'your requested date'} at{' '}
                        {selectedTime} shortly by phone or email.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {step === 1 && (
                      <div className="animate-fade-in">
                        <div className="flex flex-wrap gap-2">
                          {groupedPrimaryOfferings.map((group) => (
                            <span
                              key={group.category}
                              className="rounded-full border border-black/[0.08] bg-[#f8f5ef] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600"
                            >
                              {group.label} · {group.offerings.length}
                            </span>
                          ))}
                        </div>

                        <div className="mt-8 space-y-10">
                          {groupedPrimaryOfferings.map((group) => (
                            <div key={group.category}>
                              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                                    {group.label}
                                  </p>
                                  <h3 className="mt-2 font-display text-2xl font-semibold uppercase text-brand-black">
                                    {group.offerings.length} ways to transform the finish
                                  </h3>
                                </div>
                                <p className="max-w-xl text-sm leading-6 text-neutral-600">
                                  Browse the exact packages in this category and pick the one that
                                  delivers the result you want most.
                                </p>
                              </div>

                              <div className="grid gap-4 xl:grid-cols-2">
                                {group.offerings.map((service) => {
                                  const isSelected = selectedService?.id === service.id;
                                  return (
                                    <button
                                      key={service.id}
                                      type="button"
                                      onClick={() => setSelectedServiceId(service.id)}
                                      className={`group relative overflow-hidden rounded-[28px] border text-left transition-all duration-300 ${
                                        isSelected
                                          ? 'border-brand-mclaren bg-brand-black text-white shadow-[0_35px_90px_-45px_rgba(255,122,0,0.75)]'
                                          : 'border-black/[0.08] bg-white hover:-translate-y-1 hover:border-brand-mclaren/35 hover:shadow-[0_30px_80px_-45px_rgba(0,0,0,0.35)]'
                                      }`}
                                    >
                                      <div className="grid h-full gap-0 md:grid-cols-[minmax(0,1fr)_180px]">
                                        <div className="p-5 md:p-6">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span
                                              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                                                isSelected
                                                  ? 'bg-brand-mclaren text-white'
                                                  : 'bg-brand-mclaren/10 text-brand-mclaren'
                                              }`}
                                            >
                                              {service.shortTitle || group.label}
                                            </span>
                                            <span
                                              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                                                isSelected
                                                  ? 'border-white/12 bg-white/10 text-white/72'
                                                  : 'border-black/[0.08] bg-[#f8f5ef] text-neutral-600'
                                              }`}
                                            >
                                              {service.duration || 'Timing varies'}
                                            </span>
                                          </div>

                                          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                                            <div className="max-w-xl">
                                              <h4 className="font-display text-2xl font-semibold uppercase leading-tight">
                                                {service.title}
                                              </h4>
                                              <p
                                                className={`mt-3 text-sm leading-6 ${
                                                  isSelected ? 'text-white/70' : 'text-neutral-600'
                                                }`}
                                              >
                                                {service.description}
                                              </p>
                                            </div>
                                            <div className="text-left md:text-right">
                                              <p
                                                className={`font-display text-3xl font-semibold ${
                                                  isSelected ? 'text-white' : 'text-brand-black'
                                                }`}
                                              >
                                                {service.priceLabel}
                                              </p>
                                              {service.fixedPriceAmount && (
                                                <p
                                                  className={`mt-1 text-xs font-medium uppercase tracking-[0.12em] ${
                                                    isSelected ? 'text-white/45' : 'text-neutral-500'
                                                  }`}
                                                >
                                                  Published menu price
                                                </p>
                                              )}
                                            </div>
                                          </div>

                                          <div className="mt-5 flex flex-wrap gap-2">
                                            {service.features.slice(0, 3).map((feature) => (
                                              <span
                                                key={feature}
                                                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                                                  isSelected
                                                    ? 'bg-white/10 text-white/74'
                                                    : 'bg-[#f7f4ef] text-neutral-600'
                                                }`}
                                              >
                                                {feature}
                                              </span>
                                            ))}
                                          </div>

                                          {service.notes && (
                                            <p
                                              className={`mt-5 text-sm leading-6 ${
                                                isSelected ? 'text-white/58' : 'text-neutral-500'
                                              }`}
                                            >
                                              {service.notes}
                                            </p>
                                          )}
                                        </div>

                                        <div className="relative min-h-[220px] overflow-hidden md:min-h-full">
                                          <img
                                            src={service.image}
                                            alt={service.title}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            loading="lazy"
                                          />
                                          <div
                                            className={`absolute inset-0 ${
                                              isSelected
                                                ? 'bg-gradient-to-t from-brand-black/65 to-transparent'
                                                : 'bg-gradient-to-t from-black/20 to-transparent'
                                            }`}
                                          />
                                          {isSelected && (
                                            <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-mclaren text-white shadow-[0_15px_35px_-15px_rgba(255,122,0,0.8)]">
                                              <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {addOnOfferings.length > 0 && (
                            <div className="overflow-hidden rounded-[30px] bg-[#0f0f10] text-white shadow-[0_30px_90px_-45px_rgba(0,0,0,0.6)]">
                              <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(255,122,0,0.2),transparent_40%)] p-6">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                                      Optional upgrades
                                    </p>
                                    <h3 className="mt-3 font-display text-2xl font-semibold uppercase text-white">
                                      Stack on extra impact
                                    </h3>
                                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                                      Add-on-only services can be layered onto the main package when
                                      you want a stronger finish or a more specific fix.
                                    </p>
                                  </div>
                                  {!selectedService && (
                                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                                      Select a primary service first
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="grid gap-4 p-6 md:grid-cols-2">
                                {addOnOfferings.map((service) => {
                                  const checked = selectedAddOnIds.includes(service.id);
                                  return (
                                    <label
                                      key={service.id}
                                      className={`flex cursor-pointer gap-4 rounded-[24px] border p-4 transition ${
                                        checked
                                          ? 'border-brand-mclaren bg-brand-mclaren/12'
                                          : 'border-white/10 bg-white/6'
                                      } ${!selectedService ? 'cursor-not-allowed opacity-55' : 'hover:border-brand-mclaren/30'}`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-mclaren focus:ring-brand-mclaren"
                                        checked={checked}
                                        disabled={!selectedService}
                                        onChange={() => toggleAddOn(service.id)}
                                      />
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <p className="font-display text-xl font-semibold uppercase text-white">
                                            {service.title}
                                          </p>
                                          <p className="text-sm font-semibold text-brand-mclaren">
                                            {service.priceLabel}
                                          </p>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-white/65">
                                          {service.description}
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-10 flex justify-end">
                          <Button onClick={() => setStep(2)} disabled={!selectedService} icon>
                            Check availability
                          </Button>
                        </div>
                      </div>
                    )}
                    {step === 2 && (
                      <div className="animate-fade-in">
                        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                          <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-[#fcfbf8]">
                            <div className="border-b border-black/[0.06] bg-white p-5">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                                    Calendar
                                  </p>
                                  <p className="mt-2 font-display text-2xl font-semibold uppercase text-brand-black">
                                    Pick the date
                                  </p>
                                </div>
                                <div className="rounded-full border border-black/[0.08] bg-[#f8f5ef] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                                  {selectedService?.duration || 'Timing varies'}
                                </div>
                              </div>
                            </div>

                            <div className="p-5 md:p-6">
                              <div className="mb-4 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                                  }
                                  className="rounded-2xl border border-black/[0.08] bg-white p-2.5 text-gray-500 transition-colors hover:border-brand-mclaren/40 hover:text-brand-black"
                                >
                                  <ChevronLeft className="h-5 w-5" />
                                </button>
                                <p className="font-display text-2xl font-semibold uppercase text-brand-black">
                                  {formatMonth(currentMonth)}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                                  }
                                  className="rounded-2xl border border-black/[0.08] bg-white p-2.5 text-gray-500 transition-colors hover:border-brand-mclaren/40 hover:text-brand-black"
                                >
                                  <ChevronRight className="h-5 w-5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                  <span key={`${day}-${index}`}>{day}</span>
                                ))}
                              </div>
                              <div className="mt-3 grid grid-cols-7 gap-2">{generateDays()}</div>
                            </div>
                          </div>

                          <div className="space-y-5">
                            <div className="overflow-hidden rounded-[28px] bg-brand-black text-white shadow-[0_30px_90px_-45px_rgba(0,0,0,0.55)]">
                              <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(255,122,0,0.2),transparent_42%)] p-5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                                  Selected package
                                </p>
                                <p className="mt-3 font-display text-2xl font-semibold uppercase text-white">
                                  {selectedService?.title || 'Choose a service'}
                                </p>
                                <p className="mt-3 text-sm leading-6 text-white/68">
                                  {selectedService?.description || 'Return to step one if you need to change the service.'}
                                </p>
                              </div>

                              <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-1">
                                <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                    Requested day
                                  </p>
                                  <p className="mt-2 text-base font-medium text-white">
                                    {formatSelectedDate(selectedDate)}
                                  </p>
                                </div>
                                <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                    Requested time
                                  </p>
                                  <p className="mt-2 text-base font-medium text-white">
                                    {selectedTime || 'Choose a slot'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-[28px] border border-black/[0.08] bg-white p-5">
                              <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                                <Clock3 className="h-4 w-4 text-brand-mclaren" />
                                Available slots
                              </p>
                              {selectedDate ? (
                                <div className="custom-scrollbar grid max-h-[360px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                                  {timeSlots.map((slot) => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => setSelectedTime(slot)}
                                      className={`rounded-[20px] border px-4 py-4 text-left transition-all duration-300 ${
                                        selectedTime === slot
                                          ? 'border-brand-mclaren bg-brand-black text-white shadow-[0_20px_45px_-20px_rgba(255,122,0,0.55)]'
                                          : 'border-black/[0.08] bg-[#fcfbf8] text-brand-black hover:-translate-y-0.5 hover:border-brand-mclaren/35'
                                      }`}
                                    >
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mclaren">
                                        Open slot
                                      </p>
                                      <p className="mt-2 font-display text-xl font-semibold uppercase">
                                        {slot}
                                      </p>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-[22px] border border-dashed border-black/[0.08] bg-[#f8f5ef] px-4 py-8 text-center text-sm text-gray-500">
                                  Select a date first to unlock time slots.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-10 flex items-center justify-between">
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
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <div>
                            <div className="grid gap-5 md:grid-cols-2">
                              <label className="block rounded-[24px] border border-black/[0.08] bg-[#fcfbf8] p-4">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  Full name
                                </span>
                                <input
                                  type="text"
                                  value={details.fullName}
                                  onChange={(event) => setDetails((prev) => ({ ...prev, fullName: event.target.value }))}
                                  className="mt-3 w-full border-0 bg-transparent p-0 text-base text-brand-black outline-none placeholder:text-neutral-400"
                                  placeholder="John Doe"
                                />
                              </label>

                              <label className="block rounded-[24px] border border-black/[0.08] bg-[#fcfbf8] p-4">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  Email address
                                </span>
                                <input
                                  type="email"
                                  value={details.email}
                                  onChange={(event) => setDetails((prev) => ({ ...prev, email: event.target.value }))}
                                  className="mt-3 w-full border-0 bg-transparent p-0 text-base text-brand-black outline-none placeholder:text-neutral-400"
                                  placeholder="you@example.com"
                                />
                              </label>

                              <label className="block rounded-[24px] border border-black/[0.08] bg-[#fcfbf8] p-4">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  Phone number
                                </span>
                                <input
                                  type="tel"
                                  value={details.phone}
                                  onChange={(event) => setDetails((prev) => ({ ...prev, phone: event.target.value }))}
                                  className="mt-3 w-full border-0 bg-transparent p-0 text-base text-brand-black outline-none placeholder:text-neutral-400"
                                  placeholder="+1 (555) 000-0000"
                                />
                              </label>

                              <label className="block rounded-[24px] border border-black/[0.08] bg-[#fcfbf8] p-4">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  Vehicle details
                                </span>
                                <input
                                  type="text"
                                  value={details.vehicle}
                                  onChange={(event) => setDetails((prev) => ({ ...prev, vehicle: event.target.value }))}
                                  className="mt-3 w-full border-0 bg-transparent p-0 text-base text-brand-black outline-none placeholder:text-neutral-400"
                                  placeholder="Year, Make, Model"
                                />
                              </label>
                            </div>

                            <label className="mt-5 block rounded-[24px] border border-black/[0.08] bg-[#fcfbf8] p-4">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                Special requests
                              </span>
                              <textarea
                                value={details.notes}
                                onChange={(event) => setDetails((prev) => ({ ...prev, notes: event.target.value }))}
                                className="mt-3 h-32 w-full resize-none border-0 bg-transparent p-0 text-base text-brand-black outline-none placeholder:text-neutral-400"
                                placeholder="Tell us about stains, paint concerns, pet hair, odors, coating goals, or anything else we should know."
                              />
                            </label>

                            <div className="mt-10 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-brand-black"
                              >
                                <ArrowLeft className="h-4 w-4" /> Back
                              </button>
                              <Button onClick={handleConfirm} disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Confirm booking'}
                              </Button>
                            </div>
                            {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}
                          </div>

                          <div className="overflow-hidden rounded-[28px] bg-brand-black text-white shadow-[0_30px_90px_-45px_rgba(0,0,0,0.55)]">
                            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(255,122,0,0.22),transparent_45%)] p-5">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-mclaren">
                                Final check
                              </p>
                              <p className="mt-3 font-display text-2xl font-semibold uppercase text-white">
                                Ready to submit
                              </p>
                              <p className="mt-3 text-sm leading-6 text-white/68">
                                Make sure the contact details are correct so the team can confirm the
                                appointment quickly.
                              </p>
                            </div>

                            <div className="space-y-4 p-5">
                              <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                  Service
                                </p>
                                <p className="mt-2 text-base font-medium text-white">
                                  {selectedService?.title || 'Not selected yet'}
                                </p>
                              </div>

                              <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                  Appointment
                                </p>
                                <p className="mt-2 text-base font-medium text-white">
                                  {selectedDate ? formatSelectedDate(selectedDate) : 'Choose a date'}
                                </p>
                                <p className="mt-1 text-sm text-white/60">
                                  {selectedTime || 'Choose a time slot'}
                                </p>
                              </div>

                              <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                  Contact
                                </p>
                                <p className="mt-2 text-base font-medium text-white">
                                  {details.fullName || 'Your name'}
                                </p>
                                <p className="mt-1 text-sm text-white/60">
                                  {details.email || 'your@email.com'}
                                </p>
                                <p className="mt-1 text-sm text-white/60">
                                  {details.phone || '+1 phone number'}
                                </p>
                              </div>

                              <div className="rounded-[22px] border border-brand-mclaren/18 bg-brand-mclaren/10 p-4">
                                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                                  <Car className="h-4 w-4" />
                                  Vehicle notes help
                                </p>
                                <p className="mt-3 text-sm leading-6 text-white/78">
                                  Model, size, stains, scratches, pet hair, tint goals, or coating
                                  plans all help the team prepare accurately.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Booking;
