import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [canadaTime, setCanadaTime] = useState('');
  const location = useLocation();

  useEffect(() => {
    const updateTime = () => {
      setCanadaTime(new Date().toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { name: 'Services', path: '/services' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Gallery', path: '/gallery' },
    { name: 'Booking', path: '/booking' },
    { name: 'Repair', path: '/auto-repair' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-brand-white">
      {/* Ticker / Marquee */}
      <div className="bg-brand-black text-brand-white overflow-hidden py-2 border-b border-brand-black z-50">
        <div className="whitespace-nowrap animate-marquee flex gap-8 text-xs font-mono uppercase tracking-widest">
          <span>Free Premium Wax with every Ceramic Coating</span>
          <span>•</span>
          <span>Book Online in 60 Seconds</span>
          <span>•</span>
          <span>Open 7 Days a Week</span>
          <span>•</span>
          <span>Certified Luxury Care</span>
          <span>•</span>
          <span>Free Premium Wax with every Ceramic Coating</span>
          <span>•</span>
          <span>Book Online in 60 Seconds</span>
          <span>•</span>
          <span>Open 7 Days a Week</span>
          <span>•</span>
          <span>Certified Luxury Care</span>
        </div>
      </div>

      {/* Header - Grid Style */}
      <header className="sticky top-0 z-40 bg-brand-white border-b border-brand-black">
        <div className="flex justify-between items-stretch h-14 md:h-16">
          {/* Logo Section */}
          <Link to="/" className="flex items-center px-6 border-r border-brand-black bg-brand-white hover:bg-brand-black hover:text-white transition-colors group">
            <span className="font-display font-bold text-2xl md:text-3xl tracking-tighter uppercase">
              SPA <span className="text-brand-mclaren group-hover:text-white">FOR</span> CAR
            </span>
          </Link>

          {/* Desktop Nav - Grid */}
          <nav className="hidden md:flex flex-grow items-stretch">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                className={`flex items-center justify-center px-6 lg:px-8 border-r border-brand-black text-xs font-mono uppercase tracking-widest transition-colors hover:bg-brand-black hover:text-white ${
                  location.pathname === link.path ? 'bg-brand-black text-white' : ''
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
          
          {/* Meta / Search / Mobile Toggle */}
          <div className="flex items-stretch">
            <div className="hidden lg:flex items-center px-6 border-l border-brand-black text-xs font-mono">
              TORONTO, CA <br/> {canadaTime}
            </div>
            <button 
              className="md:hidden px-6 border-l border-brand-black hover:bg-brand-black hover:text-white transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu - Dropdown Grid */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-brand-black animate-fade-in bg-brand-white">
             {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className="block p-4 border-b border-brand-black font-display text-2xl uppercase font-bold hover:bg-brand-black hover:text-white hover:pl-6 transition-all"
              >
                {link.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Social Feeds Section */}
      <section className="border-t border-brand-black bg-gray-50 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
           <div className="col-span-2 md:col-span-4 lg:col-span-2 p-8 border-b lg:border-b-0 lg:border-r border-brand-black flex flex-col justify-center">
              <h3 className="font-display font-bold text-3xl uppercase mb-2">Social<br/>Feeds</h3>
              <p className="font-mono text-xs text-gray-500 mb-4">Follow the process. @spaforcar</p>
              <div className="flex gap-4">
                 <a href="#" className="font-mono text-xs uppercase underline hover:text-brand-accent">Instagram</a>
                 <a href="#" className="font-mono text-xs uppercase underline hover:text-brand-accent">TikTok</a>
              </div>
           </div>
           {/* Mock Feed Items */}
           {[
             'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=400',
             'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=400',
             'https://images.unsplash.com/photo-1632823469850-249d942dc38b?auto=format&fit=crop&q=80&w=400',
             'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=400'
           ].map((img, i) => (
             <div key={i} className="aspect-square border-r border-b md:border-b-0 border-brand-black relative group overflow-hidden">
                <img src={img} alt="Social Feed" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 grayscale group-hover:grayscale-0" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <ArrowUpRight className="text-white w-6 h-6" />
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* Footer - Grid Style */}
      <footer className="border-t border-brand-black bg-brand-white">
        {/* Top Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 border-b border-brand-black">
          <div className="p-8 border-b md:border-b-0 md:border-r border-brand-black">
            <h4 className="font-display font-bold text-xl uppercase mb-4">About Us</h4>
            <p className="font-mono text-xs leading-relaxed max-w-xs">
              Spa for Car is a premiere automotive detailing studio focused on restoration and preservation. We treat vehicles as art.
            </p>
          </div>
          <div className="p-8 border-b md:border-b-0 md:border-r border-brand-black">
            <h4 className="font-display font-bold text-xl uppercase mb-4">Studio</h4>
            <ul className="space-y-2 font-mono text-xs">
               <li>123 Gloss Avenue</li>
               <li>Luxury District, CA 90210</li>
               <li className="pt-2 hover:underline"><a href="mailto:concierge@spaforcar.com">concierge@spaforcar.com</a></li>
               <li className="hover:underline"><a href="tel:5551234567">+1 (555) 123-4567</a></li>
            </ul>
          </div>
          <div className="p-8 border-b md:border-b-0 md:border-r border-brand-black">
             <h4 className="font-display font-bold text-xl uppercase mb-4">Connect</h4>
             <ul className="space-y-2 font-mono text-xs">
                <li><a href="#" className="flex items-center gap-2 hover:underline">Instagram <ArrowUpRight className="w-3 h-3"/></a></li>
                <li><a href="#" className="flex items-center gap-2 hover:underline">TikTok <ArrowUpRight className="w-3 h-3"/></a></li>
                <li><a href="#" className="flex items-center gap-2 hover:underline">Twitter/X <ArrowUpRight className="w-3 h-3"/></a></li>
             </ul>
          </div>
          <div className="p-8 flex flex-col justify-between">
            <h4 className="font-display font-bold text-xl uppercase">Newsletter</h4>
            <div className="flex mt-4">
              <input type="email" placeholder="EMAIL ADDRESS" className="w-full bg-transparent border border-brand-black border-r-0 p-2 font-mono text-xs outline-none placeholder:text-gray-400 uppercase" />
              <button className="bg-brand-black text-white px-4 font-mono text-xs uppercase hover:bg-brand-accent transition-colors">Sub</button>
            </div>
          </div>
        </div>
        
        {/* Bottom Footer Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center p-2 text-[10px] font-mono uppercase tracking-widest bg-brand-white">
          <span>By Branditecture</span>
          <span className="font-bold text-lg my-2 md:my-0">SPA <span className="text-brand-mclaren">FOR</span> CAR</span>
          <span>© 2025 Spa for Car Inc.</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;