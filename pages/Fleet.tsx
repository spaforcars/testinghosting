import React from 'react';
import { Building2, Briefcase, Truck, ArrowRight } from 'lucide-react';
import Button from '../components/Button';

const Fleet: React.FC = () => {
  return (
    <div className="bg-brand-white">
      {/* B2B Hero */}
      <section className="py-24 px-4 border-b border-brand-black bg-brand-gray">
        <div className="container mx-auto text-center max-w-4xl">
          <span className="font-mono text-xs uppercase tracking-widest bg-brand-black text-white px-2 py-1">Commercial Services</span>
          <h1 className="text-[8vw] md:text-[6vw] leading-none font-display font-bold uppercase mt-8 mb-6">Partner with<br/>Precision.</h1>
          <p className="font-mono text-sm md:text-base max-w-2xl mx-auto">
            Reliable detailing solutions for Dealerships and Corporate Fleets. 
            We deliver showroom consistency at scale.
          </p>
        </div>
      </section>

      {/* Two Paths */}
      <section className="border-b border-brand-black">
        <div className="grid md:grid-cols-2">
          {/* Dealerships */}
          <div className="border-b md:border-b-0 md:border-r border-brand-black p-12 hover:bg-gray-50 transition-colors group">
            <Building2 className="w-12 h-12 mb-8" />
            <h2 className="font-display font-bold text-4xl uppercase mb-6">Dealerships</h2>
            <ul className="space-y-4 mb-12 font-mono text-xs uppercase">
              <li className="flex gap-3 border-b border-gray-200 pb-2">Pre-delivery inspections (PDI) detail</li>
              <li className="flex gap-3 border-b border-gray-200 pb-2">Lot maintenance washes</li>
              <li className="flex gap-3 border-b border-gray-200 pb-2">Showroom gloss enhancement</li>
              <li className="flex gap-3 border-b border-gray-200 pb-2">24-hour turnaround guarantee</li>
            </ul>
            <Button variant="outline">Request Dealer Rates</Button>
          </div>

          {/* Corporate Fleets */}
          <div className="p-12 hover:bg-gray-50 transition-colors group">
            <Briefcase className="w-12 h-12 mb-8" />
            <h2 className="font-display font-bold text-4xl uppercase mb-6">Corporate Fleets</h2>
            <ul className="space-y-4 mb-12 font-mono text-xs uppercase">
              <li className="flex gap-3 border-b border-gray-200 pb-2">Monthly mobile maintenance plans</li>
              <li className="flex gap-3 border-b border-gray-200 pb-2">Consolidated monthly invoicing</li>
              <li className="flex gap-3 border-b border-gray-200 pb-2">Employee perk programs</li>
              <li className="flex gap-3 border-b border-gray-200 pb-2">Executive vehicle care</li>
            </ul>
            <Button variant="outline">Get Fleet Quote</Button>
          </div>
        </div>
      </section>

      {/* Quote Form */}
      <section className="py-24 px-4 bg-brand-white">
        <div className="container mx-auto max-w-3xl border border-brand-black p-8 md:p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-12">
            <h2 className="font-display font-bold text-4xl uppercase mb-4">Request Proposal</h2>
            <p className="font-mono text-xs uppercase text-gray-500">Tell us about your volume and needs.</p>
          </div>
          
          <form className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase font-bold">Company Name</label>
                <input type="text" className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none"/>
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase font-bold">Contact Person</label>
                <input type="text" className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none"/>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase font-bold">Email Address</label>
                <input type="email" className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none"/>
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase font-bold">Phone Number</label>
                <input type="tel" className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none"/>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs uppercase font-bold">Estimated Monthly Volume</label>
              <select className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 rounded-none bg-white">
                <option>1-5 Vehicles</option>
                <option>5-20 Vehicles</option>
                <option>20-50 Vehicles</option>
                <option>50+ Vehicles</option>
              </select>
            </div>

            <div className="space-y-2">
               <label className="font-mono text-xs uppercase font-bold">Additional Details</label>
               <textarea className="w-full border border-brand-black p-3 font-mono text-sm focus:outline-none focus:bg-gray-50 h-32 rounded-none"></textarea>
            </div>

            <Button fullWidth>Submit Request</Button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Fleet;