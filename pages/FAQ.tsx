import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useCmsPage } from '../hooks/useCmsPage';
import { adaptFaqContent } from '../lib/contentAdapter';
import { defaultFaqPageContent } from '../lib/cmsDefaults';

const FAQ: React.FC = () => {
  const { data: cmsData } = useCmsPage('faq', defaultFaqPageContent);
  const content = adaptFaqContent(cmsData);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            Frequently Asked Questions
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Everything You Need To Know Before Booking
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            Clear answers about timelines, service outcomes, and care expectations.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-4xl space-y-4">
          {content.items.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <article key={faq.question} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="font-display text-xl font-semibold uppercase text-brand-black">{faq.question}</span>
                  {isOpen ? <Minus className="h-5 w-5 shrink-0 text-brand-mclaren" /> : <Plus className="h-5 w-5 shrink-0 text-brand-mclaren" />}
                </button>
                {isOpen && (
                  <div className="animate-fade-in border-t border-neutral-200 px-6 py-5 text-sm leading-relaxed text-gray-600">
                    {faq.answer}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default FAQ;
