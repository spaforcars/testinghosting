import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Shield, Droplets, Car, Sparkles, ChevronDown } from 'lucide-react';
import ServiceNotice from '../components/ServiceNotice';
import Button from '../components/Button';
import { defaultHomePageContent, defaultServicesPageContent } from '../lib/cmsDefaults';
import { adaptHomeContent, adaptServicesContent } from '../lib/contentAdapter';
import { getFeaturedOfferings } from '../lib/serviceCatalog';
import { useCmsPage } from '../hooks/useCmsPage';
import { useCmsPromos } from '../hooks/useCmsPromos';

const featureIconByName = {
  shield: Shield,
  droplets: Droplets,
  car: Car,
  sparkles: Sparkles,
} as const;

const Home: React.FC = () => {
  const { data: cmsData } = useCmsPage('home', defaultHomePageContent);
  const { data: servicesCmsData } = useCmsPage('services', defaultServicesPageContent);
  const content = adaptHomeContent(cmsData);
  const servicesContent = adaptServicesContent(servicesCmsData);
  const promos = useCmsPromos('home');
  const showcaseServices =
    content.showcaseServices.length > 0
      ? content.showcaseServices
      : getFeaturedOfferings(servicesContent).map((service) => ({
          title: service.title,
          price: service.priceLabel,
          image: service.image,
          bookingServiceId: service.id,
        }));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.sr, .stagger').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col">

      {/* ─── 1. HERO ─── */}
      <section className="relative h-screen overflow-hidden grain-overlay">
        {/* Background image */}
        <img
          src={content.heroImage}
          alt="Hero Car"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Hero content — bottom-left */}
        <div className="absolute bottom-16 left-0 right-0 px-4">
          <div className="max-w-7xl mx-auto relative z-10">
            <span className="sr inline-block bg-brand-mclaren/10 border border-brand-mclaren/30 text-brand-mclaren text-[11px] uppercase tracking-[0.15em] font-semibold px-4 py-1.5 rounded-full mb-6">
              Premium Detailing Studio
            </span>

            <h1 className="sr sr-delay-1 font-display font-extrabold text-5xl md:text-7xl lg:text-[5.5rem] text-white uppercase leading-[0.95] tracking-tight">
              {content.heroTitle}{' '}
              <span className="text-brand-mclaren">{content.heroAccent}</span>
            </h1>

            <p className="sr sr-delay-2 font-sans text-lg text-white/70 font-light max-w-xl leading-relaxed mt-6">
              {content.heroSubtitle}
            </p>

            <div className="sr sr-delay-3 flex flex-wrap items-center gap-4 mt-8">
              <Link to={content.heroButtonPath}>
                <Button variant="primary" icon>
                  {content.heroButtonLabel}
                </Button>
              </Link>
              <Link to="/gallery">
                <Button variant="outline" className="border-white/30 text-white hover:border-brand-mclaren hover:text-brand-mclaren">
                  View Our Work
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      {/* ─── 2. WHY CHOOSE US ─── */}
      <section className="relative bg-brand-black grain-overlay py-28 px-4">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16 sr">
            <h2 className="font-display text-3xl md:text-5xl font-bold uppercase text-white">
              {content.whyTitle}
            </h2>
            <p className="font-serif italic text-xl text-neutral-400 text-center mt-4 max-w-2xl mx-auto">
              {content.whyBody}
            </p>
          </div>

          <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {content.whyFeatures.map((service, idx) => {
              const Icon = featureIconByName[service.icon] || Shield;
              return (
                <div
                  key={idx}
                  className="glass rounded-2xl p-8 text-center card-hover"
                >
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-mclaren/10">
                    <Icon className="w-7 h-7 text-brand-mclaren" />
                  </div>
                  <h3 className="font-display text-lg font-semibold uppercase text-white mt-4">
                    {service.title}
                  </h3>
                  <p className="text-sm text-neutral-400 mt-3 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 3. SERVICES SHOWCASE ─── */}
      <section className="bg-brand-gray py-28 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12 sr">
            <div>
              <span className="text-brand-mclaren text-[11px] uppercase tracking-[0.15em] font-semibold">
                {content.showcaseBadge}
              </span>
              <h2 className="font-display text-3xl md:text-5xl font-bold uppercase mt-2">
                {content.showcaseTitle}
              </h2>
            </div>
            <Link
              to={content.showcaseViewAllPath}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-brand-mclaren transition-colors"
            >
              {content.showcaseViewAllLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {showcaseServices.map((item, idx) => (
              <Link
                to={item.bookingServiceId ? `/booking?service=${item.bookingServiceId}` : '/booking'}
                key={`${item.title}-${idx}`}
                className={`sr sr-delay-${Math.min(idx + 1, 4)} rounded-2xl overflow-hidden bg-white shadow-sm card-hover img-zoom block`}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-xl font-semibold uppercase">{item.title}</h3>
                  <p className="text-sm text-neutral-500 mt-1">{item.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. TESTIMONIAL ─── */}
      <section className="relative bg-brand-surface py-28 grain-overlay">
        {/* Decorative quotation mark */}
        <span className="font-serif text-[200px] leading-none text-brand-mclaren/10 absolute top-8 left-1/2 -translate-x-1/2 select-none pointer-events-none">
          &ldquo;
        </span>

        <div className="max-w-3xl mx-auto text-center relative z-10 px-4 sr">
          <div className="flex justify-center mb-6 text-brand-mclaren">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="fill-current w-5 h-5" />
            ))}
          </div>

          <p className="font-serif italic text-2xl md:text-4xl text-white leading-relaxed mt-8">
            {content.testimonialQuote}
          </p>

          <p className="text-sm uppercase tracking-[0.1em] text-neutral-500 mt-8">
            {content.testimonialAuthor}
          </p>
        </div>
      </section>

      {/* ─── 5. GALLERY TEASER ─── */}
      <section className="bg-white py-28 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sr">
            <span className="text-brand-mclaren text-[11px] uppercase tracking-[0.15em] font-semibold">
              {content.galleryBadge}
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold uppercase mt-2">
              {content.galleryTitle}
            </h2>
          </div>

          <div className="stagger grid grid-cols-1 md:grid-cols-3 gap-4">
            {content.galleryImages.map((img, i) => (
              <div
                key={i}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden img-zoom"
              >
                <img
                  src={img}
                  alt={`Recent project ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="text-white font-display font-semibold text-sm uppercase tracking-wider">
                    View Project
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 sr">
            <Link
              to={content.galleryViewAllPath}
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-brand-mclaren transition-colors glow-line"
            >
              {content.galleryViewAllLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 6. CTA ─── */}
      <section className="relative overflow-hidden py-32 bg-gradient-to-br from-[#0A0A0A] via-[#141414] to-[#0A0A0A] grain-overlay">
        {/* Decorative ambient glow */}
        <div className="absolute -right-32 -top-32 w-[500px] h-[500px] rounded-full bg-brand-mclaren/5 blur-[100px] pointer-events-none" />

        <div className="max-w-3xl mx-auto px-4 text-center relative z-10 sr">
          <h2 className="font-display text-4xl md:text-6xl font-bold uppercase text-white">
            {content.ctaTitle}
          </h2>
          <p className="font-sans text-neutral-400 mt-6 max-w-xl mx-auto leading-relaxed">
            {content.ctaBody}
          </p>
          <div className="mt-10">
            <Link to={content.ctaButtonPath}>
              <Button variant="primary" icon>
                {content.ctaButtonLabel}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 7. PROMOS ─── */}
      {promos.length > 0 && (
        <section className="bg-white px-4 py-20">
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
            {promos.slice(0, 2).map((promo, idx) => (
              <div
                key={promo._id || `${promo.title}-${idx}`}
                className="sr rounded-2xl border border-neutral-200 bg-white p-6 card-hover"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                  Promotion
                </p>
                <h3 className="mt-3 font-display text-2xl font-semibold uppercase text-brand-black">
                  {promo.title}
                </h3>
                {promo.message && (
                  <p className="mt-2 text-sm text-neutral-500 leading-relaxed">{promo.message}</p>
                )}
                {promo.ctaLink && promo.ctaLabel && (
                  <a href={promo.ctaLink} className="mt-5 inline-block">
                    <Button variant="black">{promo.ctaLabel}</Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── 8. SERVICE NOTICE ─── */}
      <ServiceNotice />
    </div>
  );
};

export default Home;
