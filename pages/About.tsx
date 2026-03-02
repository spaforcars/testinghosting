import React from 'react';
import { Award, Heart, Users } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            Our Story
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            More Than Just A Wash
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            Spa for Cars was founded to give every vehicle the same level of detail and care usually reserved for showroom exotics.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <img
              src="/client-images/IMG_2417.PNG"
              alt="Spa for Cars detailing team"
              className="h-full w-full rounded-xl object-cover"
            />
            <div className="absolute bottom-8 right-8 rounded-md bg-brand-black/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white">
              Est. 2018
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
              <h2 className="font-display text-3xl font-bold uppercase text-brand-black md:text-4xl">The Evolution</h2>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                Formerly known as Quick Shine Auto, we grew into a process-driven studio focused on lasting protection, not quick cosmetics.
                The name <strong>Spa for Cars</strong> reflects the same careful treatment and restoration mindset we apply to every vehicle.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <Award className="h-6 w-6 text-brand-mclaren" />
                <h3 className="mt-4 font-display text-xl font-semibold uppercase text-brand-black">Certified Pros</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  IDA-certified detailers with disciplined prep and finish standards.
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <Heart className="h-6 w-6 text-brand-mclaren" />
                <h3 className="mt-4 font-display text-xl font-semibold uppercase text-brand-black">Passion Driven</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  We treat daily drivers and high-performance cars with the same care.
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:col-span-2">
                <Users className="h-6 w-6 text-brand-mclaren" />
                <h3 className="mt-4 font-display text-xl font-semibold uppercase text-brand-black">Client First</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Transparent recommendations, realistic timelines, and clear communication from drop-off to handover.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
