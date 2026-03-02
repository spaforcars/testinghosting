import React, { useState } from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import Button from '../components/Button';

const Contact: React.FC = () => {
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    setTimeout(() => {
      setFormStatus('success');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            Contact
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Talk To Our Team
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            Send us your request and we will get back with recommendations, pricing, and next steps.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
            <h2 className="font-display text-3xl font-semibold uppercase text-brand-black">Send A Message</h2>

            {formStatus === 'success' ? (
              <div className="animate-fade-in mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="font-display text-xl font-semibold uppercase text-emerald-900">Message Sent</h3>
                <p className="mt-2 text-sm text-emerald-700">Thanks for reaching out. We typically respond within one business day.</p>
                <div className="mt-6">
                  <Button onClick={() => setFormStatus('idle')}>Send Another</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Full Name</label>
                  <input required type="text" className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" placeholder="John Doe" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Email Address</label>
                  <input required type="email" className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Subject</label>
                  <select className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none">
                    <option>General Inquiry</option>
                    <option>Booking Request</option>
                    <option>Fleet Program</option>
                    <option>Partnership</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Message</label>
                  <textarea required className="h-32 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none" placeholder="How can we help?" />
                </div>
                <Button type="submit" disabled={formStatus === 'submitting'} fullWidth>
                  {formStatus === 'submitting' ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            )}
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-brand-mclaren">
                  <MapPin className="h-5 w-5" />
                  <h3 className="font-display text-lg font-semibold uppercase text-brand-black">Visit Us</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Aurora, Ontario
                  <br />
                  Greater Toronto Area
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-brand-mclaren">
                  <Clock className="h-5 w-5" />
                  <h3 className="font-display text-lg font-semibold uppercase text-brand-black">Hours</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Mon-Fri: 8:00 AM - 6:00 PM
                  <br />
                  Sat: 9:00 AM - 5:00 PM
                  <br />
                  Sun: By Appointment
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-brand-mclaren">
                  <Phone className="h-5 w-5" />
                  <h3 className="font-display text-lg font-semibold uppercase text-brand-black">Phone</h3>
                </div>
                <a href="tel:4169864746" className="mt-3 block text-sm text-gray-600 transition-colors hover:text-brand-mclaren">
                  (416) 986-4746
                </a>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-brand-mclaren">
                  <Mail className="h-5 w-5" />
                  <h3 className="font-display text-lg font-semibold uppercase text-brand-black">Email</h3>
                </div>
                <a href="mailto:info@spaforcars.ca" className="mt-3 block text-sm text-gray-600 transition-colors hover:text-brand-mclaren">
                  info@spaforcars.ca
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="h-[340px]">
                <iframe
                  src="https://www.google.com/maps?q=Aurora%2C%20Ontario&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
