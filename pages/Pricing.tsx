import React from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';

const Pricing: React.FC = () => {
  const tiers = [
    {
      name: 'The Refresh',
      price: '$95',
      description: 'Essential maintenance for regular upkeep.',
      features: [
        { name: 'Foam Hand Wash', included: true },
        { name: 'Wheel Cleaning', included: true },
        { name: 'Vacuum & Wipe Down', included: true },
        { name: 'Tire Dressing', included: true },
        { name: 'Spray Wax', included: true },
        { name: 'Clay Bar Treatment', included: false },
        { name: 'Machine Polish', included: false },
        { name: 'Leather Conditioning', included: false },
        { name: 'Ceramic Sealant', included: false },
      ],
    },
    {
      name: 'Signature Detail',
      price: '$295',
      description: 'Deep clean and gloss enhancement.',
      highlight: true,
      features: [
        { name: 'Foam Hand Wash', included: true },
        { name: 'Wheel Cleaning', included: true },
        { name: 'Vacuum & Wipe Down', included: true },
        { name: 'Tire Dressing', included: true },
        { name: 'Spray Wax', included: true },
        { name: 'Clay Bar Treatment', included: true },
        { name: 'Machine Polish', included: true },
        { name: 'Leather Conditioning', included: true },
        { name: 'Ceramic Sealant', included: true },
      ],
    },
    {
      name: 'Ceramic Coating',
      price: '$800',
      description: 'Long-term protection and premium gloss.',
      features: [
        { name: 'Foam Hand Wash', included: true },
        { name: 'Wheel Cleaning', included: true },
        { name: 'Vacuum & Wipe Down', included: true },
        { name: 'Tire Dressing', included: true },
        { name: 'Spray Wax', included: true },
        { name: 'Clay Bar Treatment', included: true },
        { name: 'Machine Polish', included: true },
        { name: 'Leather Conditioning', included: true },
        { name: 'Ceramic Sealant', included: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            Transparent Pricing
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Premium Care Without Hidden Fees
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            Choose a package based on your vehicle condition and finish expectations. We can always tailor from here.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {tiers.map((tier, index) => (
            <article
              key={tier.name}
              className={`relative rounded-2xl border p-8 shadow-sm ${
                tier.highlight
                  ? 'border-brand-black bg-brand-black text-white'
                  : 'border-neutral-200 bg-white text-brand-black'
              }`}
            >
              {tier.highlight && (
                <div className="absolute right-4 top-4 rounded-full bg-orange-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-black">
                  Most Popular
                </div>
              )}

              <h2 className="font-display text-3xl font-semibold uppercase">{tier.name}</h2>
              <p className="mt-2 text-4xl font-bold">{tier.price}</p>
              <p className={`mt-3 text-sm ${tier.highlight ? 'text-neutral-300' : 'text-gray-600'}`}>{tier.description}</p>

              <div className="mt-6 space-y-3">
                {tier.features.map((feature) => (
                  <div key={feature.name} className="flex items-start gap-2 text-sm">
                    {feature.included ? (
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${tier.highlight ? 'text-orange-200' : 'text-brand-mclaren'}`} />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                    )}
                    <span className={!feature.included ? 'text-gray-400 line-through' : ''}>{feature.name}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link to={`/booking?service=${index + 1}`}>
                  <Button variant={tier.highlight ? 'white' : 'primary'} fullWidth>
                    Select Plan
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h3 className="font-display text-3xl font-bold uppercase text-brand-black">Need A Custom Scope?</h3>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            For fleet contracts, restoration projects, or unique vehicles, we can build a custom plan around your needs.
          </p>
          <div className="mt-8">
            <Link to="/contact">
              <Button variant="outline">Request Custom Quote</Button>
            </Link>
          </div>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Pricing;
