import React from 'react';
import { Award, Heart, Users } from 'lucide-react';
import { useCmsPage } from '../hooks/useCmsPage';
import { defaultAboutPageContent } from '../lib/cmsDefaults';
import { adaptAboutContent } from '../lib/contentAdapter';

const valueCardIconByName = {
  award: Award,
  heart: Heart,
  users: Users,
} as const;

const About: React.FC = () => {
  const { data: cmsData } = useCmsPage('about', defaultAboutPageContent);
  const content = adaptAboutContent(cmsData);

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
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

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <img
              src={content.image}
              alt="Spa for Cars detailing team"
              className="h-full w-full rounded-xl object-cover"
            />
            <div className="absolute bottom-8 right-8 rounded-md bg-brand-black/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white">
              {content.imageBadge}
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
              <h2 className="font-display text-3xl font-bold uppercase text-brand-black md:text-4xl">
                {content.evolutionTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                {content.evolutionBody}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {content.valueCards.map((card, index) => {
                const Icon = valueCardIconByName[card.icon] || Award;
                const gridClass = content.valueCards.length % 2 === 1 && index === content.valueCards.length - 1
                  ? 'sm:col-span-2'
                  : '';

                return (
                  <div
                    key={`${card.title}-${index}`}
                    className={`rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm ${gridClass}`}
                  >
                    <Icon className="h-6 w-6 text-brand-mclaren" />
                    <h3 className="mt-4 font-display text-xl font-semibold uppercase text-brand-black">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{card.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
