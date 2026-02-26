import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone, Mail, ArrowUpRight, ChevronDown } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [servicesMobileOpen, setServicesMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Services', path: '/services' },
    { name: 'Showcase', path: '/gallery' },
    { name: 'Contact Us', path: '/contact' },
    { name: 'Repair', path: '/auto-repair' },
  ];

  const servicesDropdownItems = [
    { name: 'All Services', path: '/services' },
    { name: 'Ceramic Coating', path: '/services' },
    { name: 'Paint Correction', path: '/services' },
    { name: 'PPF', path: '/services' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Gift Cards', path: '/gift-cards' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Info Bar */}
      <div className="bg-neutral-900 text-white py-2 z-50">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <a href="mailto:info@spaforcars.ca" className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors">
              <Mail className="w-3 h-3" /> info@spaforcars.ca
            </a>
            <a href="tel:4169864746" className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors">
              <Phone className="w-3 h-3" /> (416) 986-4746
            </a>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <a href="#" className="text-xs text-gray-300 hover:text-white transition-colors">Instagram</a>
            <a href="#" className="text-xs text-gray-300 hover:text-white transition-colors">TikTok</a>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="font-display font-bold text-2xl md:text-3xl tracking-tight">
              <span className="text-brand-mclaren">SPA</span>{' '}
              <span className="text-neutral-900">FOR</span>{' '}
              <span className="text-brand-mclaren">CARS</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              to="/"
              className={`px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors rounded ${
                location.pathname === '/' ? 'text-brand-mclaren' : 'text-neutral-700 hover:text-brand-mclaren'
              }`}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors rounded ${
                location.pathname === '/about' ? 'text-brand-mclaren' : 'text-neutral-700 hover:text-brand-mclaren'
              }`}
            >
              About
            </Link>
            {/* Services Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setServicesDropdownOpen(true)}
              onMouseLeave={() => setServicesDropdownOpen(false)}
            >
              <button
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors rounded ${
                  location.pathname === '/services' || location.pathname === '/pricing' || location.pathname === '/gift-cards'
                    ? 'text-brand-mclaren'
                    : 'text-neutral-700 hover:text-brand-mclaren'
                }`}
              >
                Services <ChevronDown className={`w-4 h-4 transition-transform ${servicesDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {servicesDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 py-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
                  {servicesDropdownItems.map((item) => (
                    <Link
                      key={item.path + item.name}
                      to={item.path}
                      className="block px-4 py-2.5 text-sm text-neutral-700 hover:bg-orange-50 hover:text-brand-mclaren transition-colors"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              to="/gallery"
              className={`px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors rounded ${
                location.pathname === '/gallery' ? 'text-brand-mclaren' : 'text-neutral-700 hover:text-brand-mclaren'
              }`}
            >
              Showcase
            </Link>
            <Link
              to="/contact"
              className={`px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors rounded ${
                location.pathname === '/contact' ? 'text-brand-mclaren' : 'text-neutral-700 hover:text-brand-mclaren'
              }`}
            >
              Contact Us
            </Link>
            <Link
              to="/auto-repair"
              className={`px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors rounded ${
                location.pathname === '/auto-repair' ? 'text-brand-mclaren' : 'text-neutral-700 hover:text-brand-mclaren'
              }`}
            >
              Repair
            </Link>
            <Link
              to="/booking"
              className="ml-4 px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold uppercase tracking-wide rounded hover:bg-brand-mclaren transition-colors"
            >
              Book Now
            </Link>
          </nav>

          {/* Mobile Toggle */}
          <button
            className="lg:hidden p-2 text-neutral-900"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 text-base font-medium uppercase tracking-wide rounded transition-colors ${
                  location.pathname === '/' ? 'text-brand-mclaren bg-orange-50' : 'text-neutral-700 hover:text-brand-mclaren hover:bg-gray-50'
                }`}
              >
                Home
              </Link>
              <Link
                to="/about"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 text-base font-medium uppercase tracking-wide rounded transition-colors ${
                  location.pathname === '/about' ? 'text-brand-mclaren bg-orange-50' : 'text-neutral-700 hover:text-brand-mclaren hover:bg-gray-50'
                }`}
              >
                About
              </Link>
              {/* Services Dropdown */}
              <div>
                <button
                  onClick={() => setServicesMobileOpen(!servicesMobileOpen)}
                  className={`flex items-center justify-between w-full px-4 py-3 text-base font-medium uppercase tracking-wide rounded transition-colors ${
                    location.pathname === '/services' || location.pathname === '/pricing' || location.pathname === '/gift-cards'
                      ? 'text-brand-mclaren bg-orange-50'
                      : 'text-neutral-700 hover:text-brand-mclaren hover:bg-gray-50'
                  }`}
                >
                  Services <ChevronDown className={`w-4 h-4 transition-transform ${servicesMobileOpen ? 'rotate-180' : ''}`} />
                </button>
                {servicesMobileOpen && (
                  <div className="pl-4 mt-1 space-y-1 border-l-2 border-gray-200 ml-4">
                    {servicesDropdownItems.map((item) => (
                      <Link
                        key={item.path + item.name}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm text-neutral-600 hover:text-brand-mclaren transition-colors"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <Link
                to="/gallery"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 text-base font-medium uppercase tracking-wide rounded transition-colors ${
                  location.pathname === '/gallery' ? 'text-brand-mclaren bg-orange-50' : 'text-neutral-700 hover:text-brand-mclaren hover:bg-gray-50'
                }`}
              >
                Showcase
              </Link>
              <Link
                to="/contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 text-base font-medium uppercase tracking-wide rounded transition-colors ${
                  location.pathname === '/contact' ? 'text-brand-mclaren bg-orange-50' : 'text-neutral-700 hover:text-brand-mclaren hover:bg-gray-50'
                }`}
              >
                Contact Us
              </Link>
              <Link
                to="/auto-repair"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 text-base font-medium uppercase tracking-wide rounded transition-colors ${
                  location.pathname === '/auto-repair' ? 'text-brand-mclaren bg-orange-50' : 'text-neutral-700 hover:text-brand-mclaren hover:bg-gray-50'
                }`}
              >
                Repair
              </Link>
              <Link
                to="/booking"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-4 py-3 mt-2 bg-neutral-900 text-white text-base font-semibold uppercase tracking-wide rounded text-center hover:bg-brand-mclaren transition-colors"
              >
                Book Now
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">{children}</main>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <span className="font-display font-bold text-2xl block mb-4">
                <span className="text-brand-mclaren">SPA</span> FOR <span className="text-brand-mclaren">CARS</span>
              </span>
              <p className="text-sm text-gray-400 leading-relaxed">
                Premium automotive detailing studio focused on ceramic coating, paint correction, and full vehicle restoration.
              </p>
            </div>
            <div>
              <h4 className="font-display font-semibold text-base uppercase tracking-wide mb-4">Quick Links</h4>
              <ul className="space-y-2">
                {navLinks.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-sm text-gray-400 hover:text-brand-mclaren transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-base uppercase tracking-wide mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Aurora, Ontario</li>
                <li>
                  <a href="mailto:info@spaforcars.ca" className="hover:text-brand-mclaren transition-colors">info@spaforcars.ca</a>
                </li>
                <li>
                  <a href="tel:4169864746" className="hover:text-brand-mclaren transition-colors">(416) 986-4746</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-base uppercase tracking-wide mb-4">Follow Us</h4>
              <div className="flex gap-4">
                <a href="#" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-mclaren transition-colors">
                  Instagram <ArrowUpRight className="w-3 h-3" />
                </a>
                <a href="#" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-mclaren transition-colors">
                  TikTok <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-800">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
            <span>© 2025 Spa for Cars Inc. All rights reserved.</span>
            <span>Powered by Branditecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
