import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react';
import { useCmsPage } from '../hooks/useCmsPage';
import { defaultNavigationContent, defaultSiteSettingsContent } from '../lib/cmsDefaults';
import { adaptNavigationContent, adaptSiteSettingsContent } from '../lib/contentAdapter';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { data: navigationData } = useCmsPage('navigation', defaultNavigationContent);
  const { data: siteSettingsData } = useCmsPage('settings', defaultSiteSettingsContent);

  const navigation = adaptNavigationContent(navigationData);
  const siteSettings = adaptSiteSettingsContent(siteSettingsData);
  const contactPhones = [siteSettings.contactPhone, siteSettings.secondaryContactPhone].filter(
    (phone, index, phones) => Boolean(phone) && phones.indexOf(phone) === index
  );

  const primaryLinks = navigation.primaryLinks.filter((link) => link.enabled);
  const secondaryLinks = navigation.secondaryLinks.filter((link) => link.enabled);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const formatTelHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-brand-gray text-brand-black">
      {/* ───── Top Bar ───── */}
      <div className="border-b border-white/[0.06] bg-[#0A0A0A]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-neutral-400 transition-colors hover:text-brand-mclaren">
              <Clock className="h-3 w-3" />
              {siteSettings.topBarHours}
            </span>
            <a
              href={`mailto:${siteSettings.contactEmail}`}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-neutral-400 transition-colors duration-300 hover:text-brand-mclaren"
            >
              <Mail className="h-3 w-3" />
              {siteSettings.contactEmail}
            </a>
            {contactPhones.map((phone) => (
              <a
                key={phone}
                href={formatTelHref(phone)}
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-neutral-400 transition-colors duration-300 hover:text-brand-mclaren"
              >
                <Phone className="h-3 w-3" />
                {phone}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <a
              href={siteSettings.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] uppercase tracking-[0.1em] text-neutral-400 transition-colors duration-300 hover:text-brand-mclaren"
            >
              Instagram
            </a>
            <a
              href={siteSettings.tiktokUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] uppercase tracking-[0.1em] text-neutral-400 transition-colors duration-300 hover:text-brand-mclaren"
            >
              TikTok
            </a>
          </div>
        </div>
      </div>

      {/* ───── Main Navigation ───── */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="group">
            <span className="font-display text-2xl font-bold tracking-tight uppercase">
              <span className="text-brand-mclaren">Spa</span>{' '}
              <span className="text-neutral-900">For</span>{' '}
              <span className="text-brand-mclaren">Cars</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {primaryLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-4 py-2 font-sans text-[13px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:bg-brand-mclaren after:transition-all after:duration-300 ${
                  isActive(link.path)
                    ? 'text-brand-mclaren after:w-full'
                    : 'text-neutral-700 after:w-0 hover:text-brand-mclaren hover:after:w-full'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={navigation.bookingCtaPath}
              className="ml-4 rounded-full bg-brand-mclaren px-6 py-2.5 font-sans text-[13px] font-medium uppercase tracking-[0.12em] text-white transition-all duration-300 hover:bg-orange-600 hover:shadow-lg hover:shadow-brand-mclaren/20"
            >
              {navigation.bookingCtaLabel}
            </Link>
          </nav>

          <button
            className="rounded-md p-2 text-neutral-900 transition-colors duration-300 hover:bg-neutral-100 lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* ───── Mobile Menu ───── */}
        {isMobileMenuOpen && (
          <div className="border-t border-black/[0.06] bg-white lg:hidden">
            <div className="mx-auto max-w-7xl space-y-1 px-4 py-6">
              {primaryLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-4 py-3 font-sans text-[13px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 ${
                    isActive(link.path)
                      ? 'text-brand-mclaren'
                      : 'text-neutral-700 hover:text-brand-mclaren'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-3 border-t border-black/[0.06]" />
              {secondaryLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="block px-4 py-3 font-sans text-[13px] font-medium uppercase tracking-[0.12em] text-neutral-500 transition-colors duration-300 hover:text-brand-mclaren"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={navigation.bookingCtaPath}
                className="mt-4 block rounded-full bg-brand-mclaren px-4 py-3 text-center font-sans text-[13px] font-medium uppercase tracking-[0.12em] text-white transition-colors duration-300 hover:bg-orange-600"
              >
                {navigation.bookingCtaLabel}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* ───── Footer ───── */}
      <footer className="relative mt-20 bg-[#0A0A0A] text-white">
        {/* Decorative gradient line */}
        <div className="h-px bg-gradient-to-r from-transparent via-brand-mclaren/40 to-transparent" />

        {/* Grain overlay */}
        <div className="grain-overlay" />

        {/* Wordmark & tagline */}
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-10">
          <div className="mb-12">
            <span className="block font-display text-4xl font-bold text-white">
              {siteSettings.businessName}
            </span>
            <p className="mt-2 font-sans text-base font-medium text-neutral-400">
              Premium detailing and paint protection studio
            </p>
          </div>

          {/* 4-column grid */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
            {/* Column 1: Navigation */}
            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                Navigation
              </h4>
              <ul className="space-y-3">
                {primaryLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className="text-sm text-neutral-400 transition-colors duration-300 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: More */}
            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                More
              </h4>
              <ul className="space-y-3">
                {secondaryLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className="text-sm text-neutral-400 transition-colors duration-300 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Services Quick Links */}
            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                Services
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    to="/services"
                    className="text-sm text-neutral-400 transition-colors duration-300 hover:text-white"
                  >
                    Paint Protection Film
                  </Link>
                </li>
                <li>
                  <Link
                    to="/services"
                    className="text-sm text-neutral-400 transition-colors duration-300 hover:text-white"
                  >
                    Ceramic Coating
                  </Link>
                </li>
                <li>
                  <Link
                    to="/services"
                    className="text-sm text-neutral-400 transition-colors duration-300 hover:text-white"
                  >
                    Full Detail
                  </Link>
                </li>
                <li>
                  <Link
                    to="/services"
                    className="text-sm text-neutral-400 transition-colors duration-300 hover:text-white"
                  >
                    Window Tint
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact */}
            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-mclaren">
                Contact
              </h4>
              <div className="space-y-3 text-sm text-neutral-400">
                <p className="leading-relaxed whitespace-pre-line">{siteSettings.address}</p>
                <p>
                  <a
                    href={`mailto:${siteSettings.contactEmail}`}
                    className="transition-colors duration-300 hover:text-white"
                  >
                    {siteSettings.contactEmail}
                  </a>
                </p>
                {contactPhones.map((phone) => (
                  <p key={phone}>
                    <a
                      href={formatTelHref(phone)}
                      className="transition-colors duration-300 hover:text-white"
                    >
                      {phone}
                    </a>
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Social links row */}
          <div className="mt-12 flex flex-wrap gap-3">
            <a
              href={siteSettings.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm text-neutral-400 transition-all duration-300 hover:border-brand-mclaren hover:text-brand-mclaren"
            >
              Instagram <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <a
              href={siteSettings.tiktokUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm text-neutral-400 transition-all duration-300 hover:border-brand-mclaren hover:text-brand-mclaren"
            >
              TikTok <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-neutral-500 md:flex-row">
            <span>&copy; {new Date().getFullYear()} {siteSettings.businessName} Inc. All rights reserved.</span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/terms-and-conditions" className="text-neutral-500 transition-colors duration-300 hover:text-white">
                Terms &amp; Conditions
              </Link>
              <Link to="/privacy-policy" className="text-neutral-500 transition-colors duration-300 hover:text-white">
                Privacy Policy
              </Link>
              <span className="text-neutral-600">{siteSettings.footerTagline}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
