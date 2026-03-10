import React, { useEffect } from 'react';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import { useCmsPage } from '../hooks/useCmsPage';
import { defaultGalleryPageContent } from '../lib/cmsDefaults';
import { adaptGalleryContent } from '../lib/contentAdapter';

const Gallery: React.FC = () => {
  const { data: cmsData } = useCmsPage('gallery', defaultGalleryPageContent);
  const content = adaptGalleryContent(cmsData);
  const transformations = content.transformations;

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
      <section className="border-b border-black/[0.06] bg-white px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl sr">
          <span className="inline-block rounded-full bg-brand-mclaren/10 border border-brand-mclaren/30 text-brand-mclaren text-[11px] tracking-[0.15em] font-semibold px-4 py-1.5 uppercase">
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
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 stagger">
          {transformations.map((item, i) => (
            <div key={`${item.label}-${i}`} className="img-zoom rounded-2xl border border-black/[0.06] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <BeforeAfterSlider
                beforeImage={item.beforeImage}
                afterImage={item.afterImage}
                label={item.label}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Gallery;
