import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';

const AutoRepair: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-brand-gray px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-brand-mclaren">
          <Wrench className="h-8 w-8" />
        </div>
        <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
          New Service Division
        </span>
        <h1 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
          Auto Repair
          <br />
          Coming Soon
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
          We are building a dedicated repair program to pair mechanical reliability with the same premium detailing standards.
        </p>

        {subscribed ? (
          <div className="animate-fade-in mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="font-display text-xl font-semibold uppercase text-emerald-900">You&apos;re on the list</p>
            <p className="mt-2 text-sm text-emerald-700">We&apos;ll notify you as soon as bookings open.</p>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email for updates"
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none"
            />
            <Button type="submit">Notify Me</Button>
          </form>
        )}
      </div>
      <ServiceNotice />
    </div>
  );
};

export default AutoRepair;
