import React from 'react';
import { Link } from 'react-router-dom';

const TermsAndConditions: React.FC = () => {
  const updatedOn = 'April 14, 2026';

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <span className="inline-block rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
            Legal
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 text-sm text-gray-500">Last updated: {updatedOn}</p>
          <p className="mt-6 max-w-4xl text-base leading-relaxed text-gray-600 md:text-lg">
            These Terms and Conditions govern use of the Spa for Cars website, booking system, and services in
            Ontario, Canada. By booking or using this website, you agree to these terms.
          </p>
        </div>
      </section>

      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-5xl space-y-8 rounded-3xl border border-black/[0.06] bg-white p-6 md:p-10">
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">1. Services and Quotes</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Service descriptions and pricing are provided for guidance. Final recommendations may change after
              in-person inspection due to paint condition, contamination, prior repairs, interior condition, or other
              vehicle-specific factors. We will confirm material changes before work proceeds.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">2. Booking and Deposits</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Appointments may require advance confirmation or deposit. You are responsible for accurate booking
              details, contact information, and vehicle information. For managed booking links, you must keep your
              booking token private.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">3. Cancellation and No-Show</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We request at least 24 hours notice for cancellation or rescheduling. Late cancellations or no-shows
              may be charged a fee to recover reserved bay time and staffing costs, to the extent permitted by
              applicable Canadian and provincial law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">
              4. Customer Responsibilities
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Before service, please remove valuables, sensitive documents, and personal items. You must disclose any
              known defects, non-factory paintwork, aftermarket modifications, warning lights, leaks, or electrical
              concerns that could affect service quality or safety.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">5. Results and Limitations</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Detailing, paint correction, coating, tint, and restoration services reduce visible defects but cannot
              guarantee permanent or flawless outcomes on every surface. Existing damage, deep scratches, rock chips,
              clear coat failure, rust, trim wear, or prior improper repairs may limit results.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">6. Warranty and Aftercare</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Any service warranty applies only to the covered service and period communicated at booking or invoice.
              Warranty claims may require inspection and proof of proper aftercare. Improper washing, chemical exposure,
              accidents, environmental fallout, or third-party work can void warranty coverage.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">7. Payments and Refunds</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Payment is due as agreed at booking or pickup/drop-off. Refund requests are reviewed case-by-case and
              handled in line with Canadian consumer protection obligations and the documented service scope.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">8. Liability</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              To the maximum extent permitted by law, Spa for Cars is not liable for indirect, incidental, or
              consequential losses. Nothing in these terms excludes liability that cannot legally be excluded under
              Canadian law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">9. Website Use</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              You agree not to misuse the website, interfere with security, attempt unauthorized access, or submit
              fraudulent bookings. We may suspend access for abusive activity.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">10. Governing Law</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              These terms are governed by the laws of the Province of Ontario and the federal laws of Canada
              applicable therein, unless mandatory local consumer law requires otherwise.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">11. Contact</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              For legal or service questions, contact us through the <Link to="/contact" className="text-brand-mclaren underline">Contact page</Link>.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
};

export default TermsAndConditions;
