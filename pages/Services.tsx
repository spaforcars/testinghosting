import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { adaptServicesContent } from '../lib/contentAdapter';
import { defaultServicesPageContent } from '../lib/cmsDefaults';
import { useCmsPage } from '../hooks/useCmsPage';

const Services: React.FC = () => {
  const { data: cmsData } = useCmsPage('services', defaultServicesPageContent);
  const content = adaptServicesContent(cmsData);
  const services = content.services;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.sr, .stagger').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="sr border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-brand-mclaren/10 border border-brand-mclaren/30 text-brand-mclaren text-[11px] tracking-[0.15em] font-semibold px-4 py-1.5 uppercase">
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
        <div className="mx-auto grid max-w-7xl gap-6 grid-cols-1">
          {services.map((service) => (
            <article
              key={service.id}
              className="sr overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] card-hover transition-shadow duration-300 hover:shadow-lg"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr]">
                <div className="img-zoom relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:h-full">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute left-4 top-4 rounded-md bg-brand-black/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
                    {service.category}
                  </div>
                </div>

                <div className="space-y-6 p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-3xl font-semibold uppercase leading-tight text-brand-black">
                        {service.title}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">{service.description}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-orange-50 px-3 py-1 text-sm font-semibold text-brand-mclaren">
                      {service.price}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-black/[0.06] bg-brand-gray p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Ideal For</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{service.idealFor}</p>
                    </div>
                    <div className="rounded-lg border border-black/[0.06] bg-brand-gray p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Process</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{service.process}</p>
                    </div>
                    <div className="rounded-lg border border-black/[0.06] bg-brand-gray p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Service Notes</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{service.notes}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {service.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-mclaren" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] pt-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                        <Clock3 className="h-4 w-4 text-brand-mclaren" />
                        Estimated time: {service.duration}
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                        <Sparkles className="h-4 w-4 text-brand-mclaren" />
                        Premium-grade products included
                      </span>
                    </div>
                    <Link to={`/booking?service=${service.id || ''}`}>
                      <Button icon>Book Now</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Services;
