import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { useCmsPage } from '../hooks/useCmsPage';
import {
  defaultPricingPageContent,
  defaultServicesPageContent,
} from '../lib/cmsDefaults';
import { adaptPricingContent, adaptServicesContent } from '../lib/contentAdapter';

const Pricing: React.FC = () => {
  const { data: pricingCmsData } = useCmsPage('pricing', defaultPricingPageContent);
  const { data: servicesCmsData } = useCmsPage('services', defaultServicesPageContent);

  const content = adaptPricingContent(pricingCmsData);
  const servicesContent = adaptServicesContent(servicesCmsData);

  const tiers = servicesContent.services;
  const fallbackHighlightId = tiers[Math.min(1, Math.max(0, tiers.length - 1))]?.id;
  const highlightServiceId = content.highlightServiceId || fallbackHighlightId;

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
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
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {tiers.map((tier) => {
            const highlight = tier.id === highlightServiceId;
            return (
              <article
                key={tier.id || tier.title}
                className={`relative rounded-2xl border p-8 shadow-sm ${
                  highlight
                    ? 'border-brand-black bg-brand-black text-white'
                    : 'border-neutral-200 bg-white text-brand-black'
                }`}
              >
                {highlight && (
                  <div className="absolute right-4 top-4 rounded-full bg-orange-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-black">
                    {content.mostPopularBadge}
                  </div>
                )}

                <h2 className="font-display text-3xl font-semibold uppercase">{tier.title}</h2>
                <p className="mt-2 text-4xl font-bold">{tier.price}</p>
                <p className={`mt-3 text-sm ${highlight ? 'text-neutral-300' : 'text-gray-600'}`}>
                  {tier.description}
                </p>

                <div className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          highlight ? 'text-orange-200' : 'text-brand-mclaren'
                        }`}
                      />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link to={`/booking?service=${tier.id || ''}`}>
                    <Button variant={highlight ? 'white' : 'primary'} fullWidth>
                      {content.selectPlanLabel}
                    </Button>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h3 className="font-display text-3xl font-bold uppercase text-brand-black">
            {content.customQuoteTitle}
          </h3>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            {content.customQuoteBody}
          </p>
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
