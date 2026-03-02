import React from 'react';
import BeforeAfterSlider from '../components/BeforeAfterSlider';

const Gallery: React.FC = () => {
  const transformations = [
    {
      label: 'Paint Correction',
      before: '/client-images/IMG_2414.PNG',
      after: '/client-images/IMG_2415.PNG',
    },
    {
      label: 'Interior Restoration',
      before: '/client-images/IMG_2460_before.PNG',
      after: '/client-images/IMG_2460_after.PNG',
    },
    {
      label: 'Steering Restoration',
      before: '/client-images/IMG_2439_before.PNG',
      after: '/client-images/IMG_2439_after.PNG',
    },
    {
      label: 'Leather Seat Restoration',
      before: '/client-images/IMG_2445_before.PNG',
      after: '/client-images/IMG_2445_after.PNG',
    },
    {
      label: 'Trim Refinement',
      before: '/client-images/IMG_2421_before.PNG',
      after: '/client-images/IMG_2421_after.PNG',
    },
    {
      label: 'Panel Correction',
      before: '/client-images/IMG_2418_before.PNG',
      after: '/client-images/IMG_2418_after.PNG',
    },
  ];

  return (
    <div className="min-h-screen bg-brand-gray">
      <section className="border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">
            Real Results
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] text-brand-black md:text-6xl">
            Before And After Transformations
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
            Drag each slider to compare real customer vehicles before and after service.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2">
          {transformations.map((item, i) => (
            <BeforeAfterSlider
              key={`${item.label}-${i}`}
              beforeImage={item.before}
              afterImage={item.after}
              label={item.label}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default Gallery;
