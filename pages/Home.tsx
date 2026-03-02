import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Shield, Droplets, Car, Sparkles } from 'lucide-react';
import ServiceNotice from '../components/ServiceNotice';

const Home: React.FC = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative w-full h-[90vh] overflow-hidden">
        <img
          src="/client-images/hero-section-pic.PNG"
          alt="Hero Car"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>

        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 w-full">
            <div className="max-w-2xl">
              <h1 className="font-display font-extrabold italic text-5xl md:text-6xl lg:text-7xl text-white uppercase leading-[1.05] mb-6">
                Ontario's Top{' '}
                <span className="text-brand-mclaren">Ceramic Coating</span>
              </h1>
              <p className="text-base md:text-lg text-gray-200 leading-relaxed mb-8 font-light">
                Preserve Your Paint | Enhance Your Car's Value | Drive with Confidence
              </p>
              <Link
                to="/booking"
                className="inline-flex items-center gap-3 rounded-lg bg-brand-mclaren px-8 py-4 font-display text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-orange-600 md:text-base"
              >
                Get Started <ArrowRight className="w-4 h-4" />
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
              Why Choose Us?
            </h2>
            <p className="text-gray-500 max-w-3xl mx-auto leading-relaxed">
              Spa for Cars specializes in high-quality car detailing that restores, protects, and enhances your vehicle. 
              We are your one-stop shop for deep interior cleaning, exterior polishing, long-lasting ceramic coating, PPF, window tinting, and much more!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Shield, title: 'Ceramic Coating', desc: 'Industry-leading 9H ceramic protection that lasts years, not months.' },
              { icon: Droplets, title: 'Paint Correction', desc: 'Multi-stage paint correction to eliminate swirls, scratches and oxidation.' },
              { icon: Car, title: 'Full Detailing', desc: 'Comprehensive interior and exterior detailing for a showroom finish.' },
              { icon: Sparkles, title: 'Window Tinting', desc: 'Premium window tinting for UV protection, privacy, and style.' },
            ].map((service, idx) => (
              <div key={idx} className="group rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-mclaren/10 transition-colors group-hover:bg-brand-mclaren/20">
                  <service.icon className="w-7 h-7 text-brand-mclaren" />
                </div>
                <h3 className="font-display font-semibold text-lg uppercase mb-3">{service.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 transition-colors">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Showcase */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <p className="text-sm text-brand-mclaren font-semibold uppercase tracking-wide mb-2">Our Services</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl uppercase">What We Offer</h2>
            </div>
            <Link to="/services" className="hidden md:flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-brand-mclaren transition-colors">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Ceramic Coating',
                price: 'From $800',
                img: '/client-images/IMG_2449.PNG',
              },
              {
                title: 'Paint Correction',
                price: 'From $500',
                img: '/client-images/IMG_2418_after.PNG',
              },
              {
                title: 'Full Detail',
                price: 'From $295',
                img: '/client-images/IMG_2461.PNG',
              },
            ].map((item, idx) => (
              <Link to="/booking" key={idx} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={item.img}
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
            "My Tesla has never looked this good. The ceramic coating is a game changer. Pure art."
          </p>
          <p className="text-sm text-gray-400">- Alex Johnson, Tesla Model S Owner</p>
        </div>
      </section>

      {/* Gallery Teaser */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm text-brand-mclaren font-semibold uppercase tracking-wide mb-2">Our Work</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl uppercase">Recent Projects</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              '/client-images/IMG_2414.PNG',
              '/client-images/IMG_2449.PNG',
              '/client-images/IMG_2462.PNG',
            ].map((img, i) => (
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
              to="/gallery"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-brand-mclaren transition-colors"
            >
              View Full Gallery <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-neutral-900 to-neutral-800 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-display font-bold text-4xl md:text-5xl uppercase text-white mb-4">
            Ready to Transform Your Vehicle?
          </h2>
          <p className="text-gray-400 mb-8">
            Book your appointment today and experience the Spa for Cars difference.
          </p>
          <Link
            to="/booking"
            className="inline-flex items-center gap-3 rounded-lg bg-brand-mclaren px-8 py-4 font-display text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-orange-600"
          >
            Book Appointment <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
      <ServiceNotice />
    </div>
  );
};

export default Home;
