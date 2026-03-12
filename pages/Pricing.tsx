import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3 } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { useCmsPage } from '../hooks/useCmsPage';
import {
  defaultPricingPageContent,
  defaultServicesPageContent,
} from '../lib/cmsDefaults';
import { adaptPricingContent, adaptServicesContent } from '../lib/contentAdapter';
import {
  getFeaturedOfferings,
  getOfferingById,
  getPrimaryOfferings,
  resolveDetailingPackages,
} from '../lib/serviceCatalog';

const Pricing: React.FC = () => {
  const { data: pricingCmsData } = useCmsPage('pricing', defaultPricingPageContent);
  const { data: servicesCmsData } = useCmsPage('services', defaultServicesPageContent);

  const content = adaptPricingContent(pricingCmsData);
  const servicesContent = adaptServicesContent(servicesCmsData);
  const detailingPackages = resolveDetailingPackages(servicesContent);
  const additionalServices = servicesContent.additionalServices.filter((service) => service.bookable);
  const featured = getFeaturedOfferings(servicesContent);
  const primaryOfferings = getPrimaryOfferings(servicesContent);
  const highlightOffering =
    getOfferingById(servicesContent, content.highlightServiceId) || featured[0] || primaryOfferings[0] || null;

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

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl sr">
          <span className="inline-block rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
            {content.badge}
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            {content.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            {content.subtitle}
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl space-y-12">
          {highlightOffering && (
            <article className="sr overflow-hidden rounded-[28px] border border-brand-black bg-brand-black text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
                <div className="relative min-h-[260px] overflow-hidden">
                  <img
                    src={highlightOffering.image}
                    alt={highlightOffering.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-4 top-4 rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                    {content.mostPopularBadge}
                  </div>
                </div>
                <div className="space-y-6 p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-3xl font-semibold uppercase">
                        {highlightOffering.title}
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
                        {highlightOffering.description}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/8 px-5 py-4 text-right">
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                        Featured Package
                      </div>
                      <div className="mt-2 text-3xl font-semibold">{highlightOffering.priceLabel}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {highlightOffering.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2 text-sm text-neutral-200">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-mclaren" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <span className="inline-flex items-center gap-2 text-sm text-neutral-300">
                      <Clock3 className="h-4 w-4 text-brand-mclaren" />
                      {highlightOffering.duration || 'Duration varies'}
                    </span>
                    <Link to={`/booking?service=${highlightOffering.id}`}>
                      <Button variant="white">{content.selectPlanLabel}</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          )}

          <section className="sr overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
            <div className="border-b border-black/[0.06] px-6 py-6 md:px-8">
              <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
                {servicesContent.detailingPackagesTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                Exact package pricing by vehicle size for the two main detailing tiers.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Vehicle Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Full Detail
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Interior Only
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {detailingPackages.map((row) => (
                    <tr key={row.vehicleType}>
                      <td className="px-6 py-5 text-sm font-semibold text-brand-black">{row.vehicleType}</td>
                      <td className="px-6 py-5 text-sm text-gray-700">
                        <div className="font-semibold text-brand-black">{row.fullDetail?.priceLabel || '-'}</div>
                        <div className="mt-1 text-gray-500">{row.fullDetail?.duration || 'Duration varies'}</div>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700">
                        <div className="font-semibold text-brand-black">
                          {row.interiorOnly?.priceLabel || '-'}
                        </div>
                        <div className="mt-1 text-gray-500">
                          {row.interiorOnly?.duration || 'Duration varies'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <div className="sr">
              <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
                Specialty Service Pricing
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                Published menu pricing for maintenance, coating, tint, and restoration services.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {servicesContent.specialtyServices.map((service) => (
                <article
                  key={service.id}
                  className="sr rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_60px_rgba(15,23,42,0.06)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                    {service.category.replace('_', ' ')}
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-semibold uppercase text-brand-black">
                    {service.shortTitle || service.title}
                  </h3>
                  <p className="mt-3 text-3xl font-semibold text-brand-black">{service.priceLabel}</p>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{service.description}</p>
                  <div className="mt-5 space-y-2">
                    {service.features.slice(0, 4).map((feature) => (
                      <div key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-mclaren" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 border-t border-black/[0.06] pt-4">
                    <Link to={`/booking?service=${service.id}`}>
                      <Button fullWidth>{content.selectPlanLabel}</Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="sr rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_60px_rgba(15,23,42,0.06)] md:p-8">
            <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
              Additional Service Pricing
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
              Additional services can be booked directly as standalone appointments.
            </p>
            <div className="mt-8 overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Add-On
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {additionalServices.map((service) => (
                    <tr key={service.id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-brand-black">{service.title}</div>
                        <div className="mt-1 text-sm text-gray-600">{service.description}</div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-brand-black">
                        {service.priceLabel}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{service.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <section className="border-t border-black/[0.06] bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl text-center sr">
          <h3 className="font-display text-3xl font-bold uppercase text-brand-black">
            {content.customQuoteTitle}
          </h3>
          <p className="mt-4 text-base leading-relaxed text-gray-600">{content.customQuoteBody}</p>
          <div className="mt-8">
            <Link to={content.customQuoteButtonPath}>
              <Button variant="outline">{content.customQuoteButtonLabel}</Button>
            </Link>
          </div>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Pricing;
