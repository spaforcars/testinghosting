import React from 'react';
import { Link } from 'react-router-dom';
import { Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { Service } from '../types';

const Services: React.FC = () => {
  type ServiceWithDetails = Service & {
    idealFor: string;
    process: string;
    notes: string;
  };

  const services: ServiceWithDetails[] = [
    {
      id: '1',
      title: 'The Refresh',
      description: 'A premium maintenance wash and light interior detail. Perfect for regular upkeep.',
      category: 'Detailing',
      price: '$95+',
      duration: '1.5 Hours',
      features: ['Foam Hand Wash', 'Wheel Cleaning', 'Vacuum & Wipe Down', 'Tire Dressing', 'Spray Wax'],
      image: '/client-images/IMG_2414.PNG',
      idealFor: 'Weekly or bi-weekly maintenance on daily-driven vehicles.',
      process: 'Safe foam pre-wash, contact wash, wheel/tire cleaning, interior vacuum, and final gloss finish.',
      notes: 'Best kept on a 2-4 week schedule for a consistently clean car.',
    },
    {
      id: '2',
      title: 'Signature Detail',
      description: 'Complete interior deep clean and exterior gloss enhancement for a near-showroom finish.',
      category: 'Detailing',
      price: '$295+',
      duration: '4 Hours',
      features: ['Everything in Refresh', 'Clay Bar Treatment', 'Machine Polish', 'Leather Conditioning', 'Steam Clean', '6-Month Sealant'],
      image: '/client-images/IMG_2461.PNG',
      idealFor: 'Vehicles that need a seasonal reset or pre-sale refresh.',
      process: 'Deep interior steam treatment, decontamination wash, paint gloss enhancement, and protective sealant.',
      notes: 'Recommended every 4-6 months depending on usage and storage conditions.',
    },
    {
      id: '3',
      title: 'Ceramic Coating',
      description: 'Long-lasting paint protection that delivers deep gloss, easier washing, and hydrophobic defense.',
      category: 'Protection',
      price: '$800+',
      duration: '1 Day',
      features: ['3-Year Warranty', 'Paint Correction', 'Extreme Hydrophobicity', 'UV Protection', 'Self-Cleaning'],
      image: '/client-images/IMG_2449.PNG',
      idealFor: 'Owners looking for long-term paint protection and easier maintenance.',
      process: 'Multi-stage prep and correction, panel wipe-down, precision coating installation, and cure inspection.',
      notes: 'Follow-up maintenance wash is recommended every 4-6 weeks.',
    },
    {
      id: '4',
      title: 'PPF Front Package',
      description: 'Invisible physical protection against rock chips and road debris for high-impact front surfaces.',
      category: 'Protection',
      price: '$1,800+',
      duration: '2 Days',
      features: ['10-Year Warranty', 'Self-Healing Film', 'Covers Bumper/Hood', 'Invisible Edges', 'Stain Resistant'],
      image: '/client-images/IMG_2421_after.PNG',
      idealFor: 'New vehicles, highway drivers, and performance cars prone to stone chips.',
      process: 'Precision template prep, edge wrapping, contaminant control, and final post-install inspection.',
      notes: 'Pairs best with ceramic coating for full exterior protection.',
    },
  ];

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            Service Menu
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Professional Detailing Packages Built For Real Results
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            Every package is built with premium products, disciplined process, and clear deliverables so you know exactly what your vehicle receives.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 grid-cols-1">
          {services.map((service) => (
            <article
              key={service.id}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr]">
                <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:h-full">
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
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Ideal For</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{service.idealFor}</p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Process</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{service.process}</p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
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

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-4">
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
                    <Link to={`/booking?service=${service.id}`}>
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
