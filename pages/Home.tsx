import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Shield, Droplets, Car, Sparkles } from 'lucide-react';
import ServiceNotice from '../components/ServiceNotice';
import { defaultHomePageContent, defaultServicesPageContent } from '../lib/cmsDefaults';
import { adaptHomeContent, adaptServicesContent } from '../lib/contentAdapter';
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
      : servicesContent.services.slice(0, 3).map((service) => ({
          title: service.title,
          price: service.price,
          image: service.image,
          bookingServiceId: service.id,
        }));

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative w-full h-[90vh] overflow-hidden">
        <img
          src={content.heroImage}
          alt="Hero Car"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>

        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 w-full">
            <div className="max-w-2xl">
              <h1 className="font-display font-extrabold italic text-5xl md:text-6xl lg:text-7xl text-white uppercase leading-[1.05] mb-6">
                {content.heroTitle}{' '}
                <span className="text-brand-mclaren">{content.heroAccent}</span>
              </h1>
              <p className="text-base md:text-lg text-gray-200 leading-relaxed mb-8 font-light">
                {content.heroSubtitle}
              </p>
              <Link
                to={content.heroButtonPath}
                className="inline-flex items-center gap-3 rounded-lg bg-brand-mclaren px-8 py-4 font-display text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-orange-600 md:text-base"
              >
                {content.heroButtonLabel} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase mb-4">
              {content.whyTitle}
            </h2>
            <p className="text-gray-500 max-w-3xl mx-auto leading-relaxed">
              {content.whyBody}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {content.whyFeatures.map((service, idx) => {
              const Icon = featureIconByName[service.icon] || Shield;
              return (
              <div key={idx} className="group rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-mclaren/10 transition-colors group-hover:bg-brand-mclaren/20">
                  <Icon className="w-7 h-7 text-brand-mclaren" />
                </div>
                <h3 className="font-display font-semibold text-lg uppercase mb-3">{service.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 transition-colors">{service.description}</p>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services Showcase */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <p className="text-sm text-brand-mclaren font-semibold uppercase tracking-wide mb-2">{content.showcaseBadge}</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl uppercase">{content.showcaseTitle}</h2>
            </div>
            <Link to={content.showcaseViewAllPath} className="hidden md:flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-brand-mclaren transition-colors">
              {content.showcaseViewAllLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {showcaseServices.map((item, idx) => (
              <Link to={item.bookingServiceId ? `/booking?service=${item.bookingServiceId}` : '/booking'} key={`${item.title}-${idx}`} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                </div>
                <div className="p-6">
                  <h3 className="font-display font-semibold text-xl uppercase mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-6 text-brand-mclaren">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="fill-current w-5 h-5" />
            ))}
          </div>
          <p className="font-display text-2xl md:text-3xl italic leading-relaxed mb-6">
            {content.testimonialQuote}
          </p>
          <p className="text-sm text-gray-400">{content.testimonialAuthor}</p>
        </div>
      </section>

      {/* Gallery Teaser */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm text-brand-mclaren font-semibold uppercase tracking-wide mb-2">{content.galleryBadge}</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl uppercase">{content.galleryTitle}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {content.galleryImages.map((img, i) => (
              <div key={i} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200">
                <img
                  src={img}
                  alt={`Recent project ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-display font-semibold text-sm uppercase tracking-wider">
                    View Project
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to={content.galleryViewAllPath}
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-brand-mclaren transition-colors"
            >
              {content.galleryViewAllLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-neutral-900 to-neutral-800 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-display font-bold text-4xl md:text-5xl uppercase text-white mb-4">
            {content.ctaTitle}
          </h2>
          <p className="text-gray-400 mb-8">
            {content.ctaBody}
          </p>
          <Link
            to={content.ctaButtonPath}
            className="inline-flex items-center gap-3 rounded-lg bg-brand-mclaren px-8 py-4 font-display text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-orange-600"
          >
            {content.ctaButtonLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
      {promos.length > 0 && (
        <section className="bg-white px-4 py-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
            {promos.slice(0, 2).map((promo, idx) => (
              <div key={promo._id || `${promo.title}-${idx}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">Promotion</p>
                <h3 className="mt-2 font-display text-2xl font-semibold uppercase text-brand-black">{promo.title}</h3>
                {promo.message && <p className="mt-2 text-sm text-gray-600">{promo.message}</p>}
                {promo.ctaLink && promo.ctaLabel && (
                  <a
                    href={promo.ctaLink}
                    className="mt-4 inline-flex rounded-md bg-brand-black px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-white"
                  >
                    {promo.ctaLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <ServiceNotice />
    </div>
  );
};

export default Home;
