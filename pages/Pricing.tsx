import React from 'react';
import Button from '../components/Button';
import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';

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
      ]
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
      ]
    },
    {
      name: 'Ceramic Coating',
      price: '$800',
      description: 'Ultimate protection and shine.',
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
      ]
    }
  ];

  return (
    <div className="bg-brand-white">
      <div className="py-24 border-b border-brand-black px-4 text-center">
         <h1 className="text-[10vw] md:text-[8vw] leading-none font-display font-bold uppercase mb-4">Pricing</h1>
         <p className="font-mono text-sm uppercase max-w-md mx-auto text-gray-500">
           Transparent pricing for premium care. No hidden fees.
         </p>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, index) => (
            <div key={index} className={`border border-brand-black p-8 flex flex-col relative ${tier.highlight ? 'bg-brand-black text-white' : 'bg-white'}`}>
              {tier.highlight && (
                <div className="absolute top-0 right-0 bg-brand-accent text-white text-xs font-mono font-bold px-3 py-1 uppercase">
                  Most Popular
                </div>
              )}
              <h3 className="font-display font-bold text-3xl uppercase mb-2">{tier.name}</h3>
              <div className="font-mono text-4xl font-bold mb-4">{tier.price}</div>
              <p className={`font-mono text-xs uppercase mb-8 ${tier.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{tier.description}</p>
              
              <div className="flex-grow space-y-4 mb-8">
                {tier.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className={`w-4 h-4 ${tier.highlight ? 'text-brand-accent' : 'text-brand-black'}`} />
                    ) : (
                      <X className="w-4 h-4 text-gray-300" />
                    )}
                    <span className={`font-mono text-xs uppercase ${!feature.included && 'text-gray-300 line-through'}`}>
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>

              <Link to={`/booking?service=${index + 1}`} className="w-full">
                <Button variant={tier.highlight ? 'white' : 'black'} className="w-full justify-center">
                  Select Plan
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
      
      {/* Additional Info */}
      <div className="border-t border-brand-black py-16 px-4 bg-gray-50">
        <div className="container mx-auto text-center max-w-2xl">
           <h3 className="font-display font-bold text-2xl uppercase mb-4">Custom Projects</h3>
           <p className="font-sans text-lg mb-8">
             Have a classic car, fleet, or specific requirement? We offer tailored packages for unique vehicles.
           </p>
           <Link to="/contact">
             <span className="font-mono text-xs uppercase underline hover:text-brand-accent">Contact for Quote</span>
           </Link>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
