import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, ShieldCheck } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { adaptServicesContent } from '../lib/contentAdapter';
import { defaultServicesPageContent } from '../lib/cmsDefaults';
import { resolveDetailingPackages } from '../lib/serviceCatalog';
import { useCmsPage } from '../hooks/useCmsPage';

const formatCategoryLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const heroSkeletonClass = 'animate-pulse rounded-full bg-neutral-100';

const serviceImageOverrides: Record<string, string> = {
  'window-tint-complete-vehicle': '/client-images/IMG_2417.PNG',
  'window-tint-two-front': '/client-images/IMG_2465.PNG',
};

const Services: React.FC = () => {
  const { data: cmsData, loading } = useCmsPage('services', defaultServicesPageContent);
  const adaptedContent = adaptServicesContent(cmsData);
  const content = {
    ...adaptedContent,
    specialtyServices: adaptedContent.specialtyServices.map((service) => ({
      ...service,
      image: serviceImageOverrides[service.id] || service.image,
    })),
  };
  const detailingPackages = resolveDetailingPackages(content);
  const additionalServices = content.additionalServices.filter((service) => service.bookable);

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
      <section className="sr border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className={`${heroSkeletonClass} h-9 w-36`} aria-hidden="true" />
          ) : (
            <span className="inline-block rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
              {content.badge}
            </span>
          )}
          {loading ? (
            <div className="mt-5 max-w-4xl space-y-3" aria-hidden="true">
              <div className={`${heroSkeletonClass} h-14 w-full`} />
              <div className={`${heroSkeletonClass} h-14 w-[88%]`} />
              <div className={`${heroSkeletonClass} h-14 w-[76%]`} />
            </div>
          ) : (
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
              {content.title}
            </h1>
          )}
          {loading ? (
            <div className="mt-6 max-w-3xl space-y-3" aria-hidden="true">
              <div className={`${heroSkeletonClass} h-6 w-full`} />
              <div className={`${heroSkeletonClass} h-6 w-[84%]`} />
            </div>
          ) : (
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
              {content.subtitle}
            </p>
          )}
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl space-y-12">
          <article className="sr overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="border-b border-black/[0.06] px-6 py-6 md:px-8">
              <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
                {content.detailingPackagesTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                Select the vehicle-size tier that matches your vehicle. Full Detail covers both exterior
                and interior care. Interior Only focuses on the cabin, upholstery, carpets, and trim.
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
                      <td className="px-6 py-5 align-top">
                        <div className="text-sm font-semibold text-brand-black">{row.vehicleType}</div>
                      </td>
                      <td className="px-6 py-5 align-top">
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="text-lg font-semibold text-brand-black">
                              {row.fullDetail?.priceLabel || '-'}
                            </div>
                            <div className="text-sm text-gray-600">{row.fullDetail?.duration || 'Timing varies'}</div>
                          </div>
                          {row.fullDetail && (
                            <Link to={`/booking?service=${row.fullDetail.id}`}>
                              <Button className="px-5 py-2.5 text-[11px]">Book Service</Button>
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top">
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="text-lg font-semibold text-brand-black">
                              {row.interiorOnly?.priceLabel || '-'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {row.interiorOnly?.duration || 'Timing varies'}
                            </div>
                          </div>
                          {row.interiorOnly && (
                            <Link to={`/booking?service=${row.interiorOnly.id}`}>
                              <Button variant="outline" className="px-5 py-2.5 text-[11px]">
                                Book Service
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="grid gap-6 lg:grid-cols-2 stagger">
            <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)] md:p-8">
              <h3 className="font-display text-2xl font-semibold uppercase text-brand-black">
                {content.exteriorIncludesTitle}
              </h3>
              <div className="mt-6 grid gap-3">
                {content.exteriorIncludes.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-mclaren" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)] md:p-8">
              <h3 className="font-display text-2xl font-semibold uppercase text-brand-black">
                {content.interiorIncludesTitle}
              </h3>
              <div className="mt-6 grid gap-3">
                {content.interiorIncludes.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-mclaren" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="space-y-6">
            <div className="sr">
              <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
                {content.specialtyServicesTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                Protection, maintenance, tint, and restoration services with clear scope, pricing, and
                expected timing.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {content.specialtyServices.map((service) => (
                <article
                  key={service.id}
                  className="sr overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr]">
                    <div className="relative min-h-[220px] overflow-hidden">
                      <img
                        src={service.image}
                        alt={service.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute left-4 top-4 rounded-md bg-brand-black/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                        {formatCategoryLabel(service.category)}
                      </div>
                    </div>
                    <div className="space-y-5 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-2xl font-semibold uppercase text-brand-black">
                            {service.title}
                          </h3>
                          <p className="mt-3 text-sm leading-6 text-gray-600">{service.description}</p>
                        </div>
                        <div className="rounded-xl bg-[#fff4eb] px-4 py-2 text-right">
                          <div className="text-sm font-semibold text-brand-mclaren">{service.priceLabel}</div>
                          <div className="mt-1 text-xs text-gray-500">{service.duration || 'Timing varies'}</div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {service.features.map((feature) => (
                          <div key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-mclaren" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] pt-4">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                          <Clock3 className="h-4 w-4 text-brand-mclaren" />
                          {service.duration || 'Timing varies'}
                        </span>
                        <Link to={`/booking?service=${service.id}`}>
                          <Button icon>Book Service</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="sr rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)] md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">
                  {content.additionalServicesTitle}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                  Standalone services available for direct booking without a package.
                </p>
              </div>
              <Link to="/booking">
                <Button variant="outline">Start Booking</Button>
              </Link>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Action
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
                      <td className="px-4 py-4">
                        <Link to={`/booking?service=${service.id}`}>
                          <Button variant="outline" className="px-5 py-2.5 text-[11px]">
                            Book Service
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <ServiceNotice />
    </div>
  );
};

export default Services;
