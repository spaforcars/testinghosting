import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import Button from '../components/Button';
import { apiRequest, ApiError } from '../lib/apiClient';
import { useCmsPage } from '../hooks/useCmsPage';
import { adaptContactContent } from '../lib/contentAdapter';
import { defaultContactPageContent } from '../lib/cmsDefaults';

const Contact: React.FC = () => {
  const { data: cmsData } = useCmsPage('contact', defaultContactPageContent);
  const content = adaptContactContent(cmsData);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.sr, .stagger').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    setFormError(null);

    try {
      await apiRequest('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          message: `[${formData.subject}] ${formData.message}`,
          serviceType: formData.subject,
          sourcePage: 'contact',
          metadata: { type: 'contact_form' },
        }),
      });
      setFormStatus('success');
      setFormData({
        fullName: '',
        email: '',
        subject: 'General Inquiry',
        message: '',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to send message';
      setFormError(message);
      setFormStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="sr border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-brand-mclaren/10 border border-brand-mclaren/30 text-brand-mclaren text-[11px] tracking-[0.15em] font-semibold px-4 py-1.5 uppercase">
            Contact
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
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="sr rounded-2xl border border-black/[0.06] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-10">
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
                  <input
                    required
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Subject</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                  >
                    <option>General Inquiry</option>
                    <option>Booking Request</option>
                    <option>Fleet Program</option>
                    <option>Partnership</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Message</label>
                  <textarea
                    required
                    value={formData.message}
                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                    className="h-32 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-brand-black focus:border-brand-mclaren focus:outline-none focus:ring-2 focus:ring-brand-mclaren/20"
                    placeholder="How can we help?"
                  />
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <Button type="submit" disabled={formStatus === 'submitting'} fullWidth>
                  {formStatus === 'submitting' ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            )}
          </div>

          <div className="space-y-6">
            <div className="sr stagger grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] card-hover">
                <div className="flex items-center gap-2 text-brand-mclaren">
                  <MapPin className="h-5 w-5" />
                  <h3 className="font-display text-lg font-semibold uppercase text-brand-black">Visit Us</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {content.address.split('\n').map((line) => (
                    <React.Fragment key={line}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </p>
              </div>
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] card-hover">
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
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] card-hover">
                <div className="flex items-center gap-2 text-brand-mclaren">
                  <Phone className="h-5 w-5" />
                  <h3 className="font-display text-lg font-semibold uppercase text-brand-black">Phone</h3>
                </div>
                <a href="tel:4169864746" className="mt-3 block text-sm text-gray-600 transition-colors hover:text-brand-mclaren">
                  (416) 986-4746
                </a>
              </div>
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] card-hover">
                <div className="flex items-center gap-2 text-brand-mclaren">
                  <Mail className="h-5 w-5" />
                  <h3 className="font-display text-lg font-semibold uppercase text-brand-black">Email</h3>
                </div>
                <a href="mailto:info@spaforcars.ca" className="mt-3 block text-sm text-gray-600 transition-colors hover:text-brand-mclaren">
                  info@spaforcars.ca
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="h-[340px]">
                <iframe
                  src={content.mapEmbedUrl}
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
