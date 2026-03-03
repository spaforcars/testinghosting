import React from 'react';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import { useCmsPage } from '../hooks/useCmsPage';
import { defaultGalleryPageContent } from '../lib/cmsDefaults';
import { adaptGalleryContent } from '../lib/contentAdapter';

const Gallery: React.FC = () => {
  const { data: cmsData } = useCmsPage('gallery', defaultGalleryPageContent);
  const content = adaptGalleryContent(cmsData);
  const transformations = content.transformations;

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
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2">
          {transformations.map((item, i) => (
            <BeforeAfterSlider
              key={`${item.label}-${i}`}
              beforeImage={item.beforeImage}
              afterImage={item.afterImage}
              label={item.label}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default Gallery;
