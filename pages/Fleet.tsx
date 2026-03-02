import React from 'react';
import { Building2, Briefcase, ShieldCheck } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';

const Fleet: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            Commercial Programs
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Premium Detailing for Private Owners & Commercial Fleets
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            We deliver consistent turnaround, clean reporting, and scalable service plans for businesses that need vehicle presentation standards maintained.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <Building2 className="h-10 w-10 text-brand-mclaren" />
            <h2 className="mt-5 font-display text-3xl font-semibold uppercase text-brand-black">Dealerships</h2>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />Pre-delivery inspection detailing</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />Lot maintenance wash scheduling</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />Showroom finish enhancement</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />Priority turnaround windows</li>
            </ul>
            <div className="mt-8">
              <Button variant="outline">Request Dealer Rates</Button>
            </div>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <Briefcase className="h-10 w-10 text-brand-mclaren" />
            <h2 className="mt-5 font-display text-3xl font-semibold uppercase text-brand-black">Corporate Fleets</h2>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />Monthly or bi-weekly service plans</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />Consolidated invoicing</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />On-site and studio service options</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />Executive vehicle care tiers</li>
            </ul>
            <div className="mt-8">
              <Button variant="outline">Get Fleet Quote</Button>
            </div>
          </article>
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-brand-gray p-8 shadow-sm md:p-10">
          <h3 className="font-display text-3xl font-semibold uppercase text-brand-black">Request Proposal</h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Share your monthly volume and service expectations. We will provide a tailored plan and pricing recommendation.
          </p>

          <form className="mt-8 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Company Name</label>
                <input type="text" className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Contact Person</label>
                <input type="text" className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Email Address</label>
                <input type="email" className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Phone Number</label>
                <input type="tel" className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Estimated Monthly Volume</label>
              <select className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none">
                <option>1-5 Vehicles</option>
                <option>5-20 Vehicles</option>
                <option>20-50 Vehicles</option>
                <option>50+ Vehicles</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Additional Details</label>
              <textarea className="h-32 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" />
            </div>

            <Button fullWidth>Submit Request</Button>
          </form>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Fleet;
