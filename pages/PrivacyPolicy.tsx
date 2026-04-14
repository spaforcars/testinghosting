import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const updatedOn = 'April 14, 2026';

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <span className="inline-block rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
            Legal
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-gray-500">Last updated: {updatedOn}</p>
          <p className="mt-6 max-w-4xl text-base leading-relaxed text-gray-600 md:text-lg">
            This Privacy Policy explains how Spa for Cars collects, uses, discloses, and protects personal
            information in accordance with applicable Canadian privacy laws, including PIPEDA and similar provincial
            requirements where applicable.
          </p>
        </div>
      </section>

      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-5xl space-y-8 rounded-3xl border border-black/[0.06] bg-white p-6 md:p-10">
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">
              1. Information We Collect
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We may collect contact details (name, email, phone), vehicle details, booking and scheduling
              information, service history, communication logs, and payment-related metadata. If you upload photos, we
              store them for booking fulfillment and quality review.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">
              2. Why We Use Your Information
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We use personal information to provide requested services, process bookings, communicate updates, send
              invoices/receipts, improve operations, prevent fraud, and comply with legal obligations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">3. Consent</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              By using this website or booking services, you consent to collection and use of information as described
              here. You may withdraw consent for non-essential communications at any time, subject to legal or
              contractual limits.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">
              4. Service Providers and Sharing
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We use trusted service providers (for example hosting, analytics, payment processing, communication, and
              database providers) to operate our business. We do not sell personal information. We only share data as
              necessary to deliver services, meet legal requirements, or protect rights and safety.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">5. Data Retention</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We retain information only as long as reasonably necessary for service delivery, record-keeping,
              warranty, dispute resolution, and legal compliance, then securely delete or anonymize when no longer
              required.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">6. Security</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We apply reasonable administrative, technical, and physical safeguards to protect data against
              unauthorized access, loss, misuse, or disclosure. No system can be guaranteed 100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">7. Your Privacy Rights</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Subject to applicable law, you may request access to personal information we hold about you, request
              corrections, and ask questions about our privacy practices. We will respond within legally required
              timelines.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">8. Cookies and Analytics</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We may use cookies or similar technologies for session management, security, and website performance.
              You can adjust browser settings to reject cookies, but parts of the site may not function correctly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">
              9. Cross-Border Processing
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Some service providers may process data outside your province or outside Canada. Where this occurs, data
              may be subject to lawful access by foreign authorities under applicable laws.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">10. Policy Updates</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We may update this policy from time to time. Updates will be posted on this page with a revised "Last
              updated" date.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">11. Contact</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              To submit a privacy request or complaint, contact us via the <Link to="/contact" className="text-brand-mclaren underline">Contact page</Link>.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
