import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const primaryLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Showcase', path: '/gallery' },
    { name: 'Fleet', path: '/fleet' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const secondaryLinks = [
    { name: 'FAQ', path: '/faq' },
    { name: 'Gift Cards', path: '/gift-cards' },
    { name: 'Auto Repair', path: '/auto-repair' },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-brand-gray text-brand-black">
      <div className="border-b border-neutral-800 bg-neutral-950 text-neutral-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-neutral-300">
              <Clock className="h-3.5 w-3.5" />
              Mon-Sat 8:00 AM - 6:00 PM
            </span>
            <a
              href="mailto:info@spaforcars.ca"
              className="inline-flex items-center gap-1.5 text-neutral-300 transition-colors hover:text-white"
            >
              <Mail className="h-3.5 w-3.5" />
              info@spaforcars.ca
            </a>
            <a
              href="tel:4169864746"
              className="inline-flex items-center gap-1.5 text-neutral-300 transition-colors hover:text-white"
            >
              <Phone className="h-3.5 w-3.5" />
              (416) 986-4746
            </a>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-300 transition-colors hover:text-white"
            >
              Instagram
            </a>
            <a
              href="https://www.tiktok.com"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-300 transition-colors hover:text-white"
            >
              TikTok
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:h-20">
          <Link to="/" className="group">
            <span className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              <span className="text-brand-mclaren transition-colors group-hover:text-orange-600">SPA</span>{' '}
              <span className="text-neutral-900">FOR</span>{' '}
              <span className="text-brand-mclaren transition-colors group-hover:text-orange-600">CARS</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {primaryLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em] transition-colors ${
                  isActive(link.path)
                    ? 'bg-orange-50 text-brand-mclaren'
                    : 'text-neutral-700 hover:text-brand-mclaren'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/booking"
              className="ml-3 rounded-lg bg-brand-mclaren px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-orange-600"
            >
              Book Now
            </Link>
          </nav>

          <button
            className="rounded-md p-2 text-neutral-900 transition-colors hover:bg-neutral-100 lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="border-t border-neutral-200 bg-white lg:hidden">
            <div className="mx-auto max-w-7xl space-y-1 px-4 py-4">
              {primaryLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block rounded-md px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] transition-colors ${
                    isActive(link.path)
                      ? 'bg-orange-50 text-brand-mclaren'
                      : 'text-neutral-700 hover:bg-neutral-50 hover:text-brand-mclaren'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              <div className="my-3 border-t border-neutral-200" />
              {secondaryLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="block rounded-md px-4 py-3 text-sm font-medium uppercase tracking-[0.08em] text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-brand-mclaren"
                >
                  {link.name}
                </Link>
              ))}
              <Link
                to="/booking"
                className="mt-2 block rounded-lg bg-brand-mclaren px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-orange-600"
              >
                Book Appointment
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 bg-neutral-950 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-4">
          <div>
            <span className="mb-4 block font-display text-2xl font-bold">
              <span className="text-brand-mclaren">SPA</span> FOR{' '}
              <span className="text-brand-mclaren">CARS</span>
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-neutral-400">
              Premium detailing and paint protection studio serving Aurora and the greater Toronto area.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-neutral-200">Navigation</h4>
            <ul className="space-y-2">
              {primaryLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-sm text-neutral-400 transition-colors hover:text-brand-mclaren">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-neutral-200">More</h4>
            <ul className="space-y-2">
              {secondaryLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-sm text-neutral-400 transition-colors hover:text-brand-mclaren">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-neutral-200">Contact</h4>
            <div className="space-y-2 text-sm text-neutral-400">
              <p>Aurora, Ontario</p>
              <p>
                <a href="mailto:info@spaforcars.ca" className="transition-colors hover:text-brand-mclaren">
                  info@spaforcars.ca
                </a>
              </p>
              <p>
                <a href="tel:4169864746" className="transition-colors hover:text-brand-mclaren">
                  (416) 986-4746
                </a>
              </p>
              <div className="flex gap-4 pt-2">
                <a
                  href="https://www.instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-mclaren"
                >
                  Instagram <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href="https://www.tiktok.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-mclaren"
                >
                  TikTok <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-800">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-neutral-500 md:flex-row">
            <span>&copy; {new Date().getFullYear()} Spa for Cars Inc. All rights reserved.</span>
            <span>Designed for premium automotive care</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
