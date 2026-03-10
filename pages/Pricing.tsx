import React, { useEffect } from 'react';
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
      <section className="border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl sr">
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
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3 stagger">
          {tiers.map((tier) => {
            const highlight = tier.id === highlightServiceId;
            return (
              <article
                key={tier.id || tier.title}
                className={`relative rounded-2xl border p-8 card-hover ${
                  highlight
                    ? 'grain-overlay border-brand-black bg-brand-black text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                    : 'border-black/[0.06] bg-white text-brand-black shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                }`}
              >
                {highlight && (
                  <div className="absolute right-4 top-4 rounded-full bg-brand-mclaren/10 border border-brand-mclaren/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
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
                          highlight ? 'text-brand-mclaren' : 'text-brand-mclaren'
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

      <section className="border-t border-black/[0.06] bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl text-center sr">
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
