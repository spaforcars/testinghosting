import React, { useState, useEffect } from 'react';
import { Building2, Briefcase, ShieldCheck } from 'lucide-react';
import Button from '../components/Button';
import ServiceNotice from '../components/ServiceNotice';
import { apiRequest, ApiError } from '../lib/apiClient';
import { adaptFleetContent } from '../lib/contentAdapter';
import { defaultFleetPageContent } from '../lib/cmsDefaults';
import { useCmsPage } from '../hooks/useCmsPage';

const Fleet: React.FC = () => {
  const { data: cmsData } = useCmsPage('fleet', defaultFleetPageContent);
  const content = adaptFleetContent(cmsData);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    volume: '1-5 Vehicles',
    details: '',
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.sr, .stagger').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const submitFleetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    setFormError(null);

    try {
      await apiRequest('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.contactPerson || formData.companyName,
          email: formData.email,
          phone: formData.phone,
          message: formData.details || `Fleet proposal request for ${formData.companyName}`,
          serviceType: 'Fleet Proposal',
          sourcePage: 'fleet',
          metadata: {
            companyName: formData.companyName,
            volume: formData.volume,
          },
        }),
      });
      setFormStatus('success');
      setFormData({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        volume: '1-5 Vehicles',
        details: '',
      });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Failed to submit request');
      setFormStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="sr border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
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

      <section className="sr px-4 py-16 md:py-20">
        <div className="stagger mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
          <article className="sr-delay-1 card-hover rounded-2xl border border-black/[0.06] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Building2 className="h-10 w-10 text-brand-mclaren" />
            <h2 className="mt-5 font-display text-3xl font-semibold uppercase text-brand-black">{content.dealershipsTitle}</h2>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              {content.dealershipsItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button variant="outline">Request Dealer Rates</Button>
            </div>
          </article>

          <article className="sr-delay-2 card-hover rounded-2xl border border-black/[0.06] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Briefcase className="h-10 w-10 text-brand-mclaren" />
            <h2 className="mt-5 font-display text-3xl font-semibold uppercase text-brand-black">{content.fleetsTitle}</h2>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              {content.fleetsItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-mclaren" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button variant="outline">Get Fleet Quote</Button>
            </div>
          </article>
        </div>
      </section>

      <section className="sr border-t border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl rounded-2xl border border-black/[0.06] bg-brand-gray p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-10">
          <h3 className="font-display text-3xl font-semibold uppercase text-brand-black">{content.proposalTitle}</h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {content.proposalSubtitle}
          </p>

          {formStatus === 'success' ? (
            <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Request submitted. Our team will contact you shortly.
            </div>
          ) : (
          <form onSubmit={submitFleetRequest} className="mt-8 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Company Name</label>
                <input
                  required
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                  className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Contact Person</label>
                <input
                  required
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))}
                  className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Email Address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Phone Number</label>
                <input
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Estimated Monthly Volume</label>
              <select
                value={formData.volume}
                onChange={(e) => setFormData((prev) => ({ ...prev, volume: e.target.value }))}
                className="w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
              >
                <option>1-5 Vehicles</option>
                <option>5-20 Vehicles</option>
                <option>20-50 Vehicles</option>
                <option>50+ Vehicles</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Additional Details</label>
              <textarea
                value={formData.details}
                onChange={(e) => setFormData((prev) => ({ ...prev, details: e.target.value }))}
                className="h-32 w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <Button fullWidth disabled={formStatus === 'submitting'}>
              {formStatus === 'submitting' ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
          )}
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Fleet;
