import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useCmsPage } from '../hooks/useCmsPage';
import { adaptFaqContent } from '../lib/contentAdapter';
import { defaultFaqPageContent } from '../lib/cmsDefaults';

const FAQ: React.FC = () => {
  const { data: cmsData } = useCmsPage('faq', defaultFaqPageContent);
  const content = adaptFaqContent(cmsData);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.sr, .stagger').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="sr border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full border border-brand-mclaren/30 bg-brand-mclaren/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
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
        <div className="sr mx-auto max-w-4xl space-y-4">
          {content.items.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <article key={faq.question} className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="font-display text-xl font-semibold uppercase text-brand-black">{faq.question}</span>
                  {isOpen ? <Minus className="h-5 w-5 shrink-0 text-brand-mclaren" /> : <Plus className="h-5 w-5 shrink-0 text-brand-mclaren" />}
                </button>
                {isOpen && (
                  <div className="animate-fade-in border-t border-black/[0.06] px-6 py-5 text-sm leading-relaxed text-gray-600">
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
