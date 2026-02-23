import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import { ArrowRight, Star } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section - GARM Style */}
      <section className="relative w-full h-[85vh] md:h-screen border-b border-brand-black overflow-hidden flex flex-col">
        {/* Main Hero Visual */}
        <div className="relative flex-grow w-full overflow-hidden">
           <img 
            src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80" 
            alt="Hero Car" 
            className="w-full h-full object-cover object-center"
           />
           
           {/* Massive Overlay Text */}
           <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none mix-blend-difference">
              <h1 className="text-[12vw] leading-[0.8] font-display font-bold text-white tracking-tighter text-center">
                SPA FOR<br/>CAR
              </h1>
           </div>
           
           <div className="absolute bottom-12 right-12 md:right-24 z-10 hidden md:block">
              <Link to="/booking">
                <Button variant="white" icon>SHOP NOW</Button>
              </Link>
           </div>
        </div>

        {/* Hero Bottom Bar Info */}
        <div className="border-t border-brand-black bg-brand-white p-4 flex justify-between items-center text-xs font-mono uppercase tracking-widest">
           <span>Winter Collection 3 Out Now.</span>
           <Link to="/services" className="flex items-center gap-2 hover:underline group">
             Browse Catalog <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/>
           </Link>
        </div>
      </section>

      {/* Intro Text Block */}
      <section className="py-24 px-4 border-b border-brand-black text-center bg-brand-white">
        <div className="max-w-4xl mx-auto space-y-6">
          <p className="font-mono text-xs uppercase tracking-widest text-gray-500">Welcome to Spa for Car.</p>
          <h2 className="font-display font-bold text-4xl md:text-6xl uppercase leading-none">
            Explore the <span className="text-outline">Catalog</span>.
          </h2>
          <p className="font-sans text-lg max-w-2xl mx-auto leading-relaxed">
             We don't just wash cars; we curate them. Experience the gloss, calm, and precision of a five-star automotive treatment.
          </p>
        </div>
      </section>

      {/* Split Screen Categories (Mens/Womens style) */}
      <section className="grid grid-cols-1 md:grid-cols-2 border-b border-brand-black">
        {/* Left: Exterior */}
        <div className="group relative h-[80vh] border-b md:border-b-0 md:border-r border-brand-black overflow-hidden">
           <img 
             src="https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=1200" 
             alt="Exterior"
             className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
           />
           <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
           <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2">
             <Link to="/services" className="bg-white px-8 py-3 font-display font-bold text-xl uppercase tracking-widest border border-brand-black hover:bg-brand-black hover:text-white transition-colors">
               Exterior
             </Link>
           </div>
        </div>

        {/* Right: Interior */}
        <div className="group relative h-[80vh] overflow-hidden">
           <img 
             src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=1200" 
             alt="Interior"
             className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
           />
           <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
           <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2">
             <Link to="/services" className="bg-white px-8 py-3 font-display font-bold text-xl uppercase tracking-widest border border-brand-black hover:bg-brand-black hover:text-white transition-colors">
               Interior
             </Link>
           </div>
        </div>
      </section>

      {/* Grid Collections/Services */}
      <div className="border-b border-brand-black flex justify-between items-center p-4 bg-brand-white">
        <span className="font-mono text-xs uppercase">Featured Services</span>
        <span className="font-mono text-xs uppercase">Winter 2025</span>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 border-b border-brand-black">
        {[
          {
            title: "Ceramic Coating",
            price: "$800.00",
            img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800"
          },
          {
            title: "Paint Correction",
            price: "$500.00",
            img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800"
          },
          {
            title: "Full Detail",
            price: "$295.00",
            img: "https://images.unsplash.com/photo-1605515298946-d062f2e9da53?auto=format&fit=crop&q=80&w=800"
          }
        ].map((item, idx) => (
          <div key={idx} className={`group border-b md:border-b-0 ${idx !== 2 ? 'md:border-r' : ''} border-brand-black bg-brand-white`}>
            <div className="relative aspect-[4/5] overflow-hidden border-b border-brand-black">
               <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 saturate-0 group-hover:saturate-100" />
               <div className="absolute top-4 right-4 bg-white border border-brand-black px-2 py-1 font-mono text-xs font-bold">
                 NEW
               </div>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
               <h3 className="font-display font-bold text-2xl uppercase mb-2">{item.title}</h3>
               <p className="font-mono text-sm text-gray-500 mb-4">{item.price}</p>
               <Link to="/booking" className="text-xs font-mono uppercase underline hover:text-brand-accent">Add to Cart</Link>
            </div>
          </div>
        ))}
      </section>
      
      {/* Testimonial Ticker */}
      <div className="bg-brand-black text-white py-12 border-b border-brand-black overflow-hidden relative">
        <div className="container mx-auto px-4 text-center">
           <div className="flex justify-center mb-6 text-brand-accent">
             {[1,2,3,4,5].map(i => <Star key={i} className="fill-current w-6 h-6"/>)}
           </div>
           <p className="font-display text-2xl md:text-4xl uppercase leading-tight max-w-4xl mx-auto">
             "My Tesla has never looked this good. The ceramic coating is a game changer. Pure art."
           </p>
           <p className="font-mono text-xs mt-6 text-gray-400">— Alex Johnson, Model S</p>
        </div>
      </div>

      {/* Lookbook / Gallery Teaser */}
      <section className="grid grid-cols-1 md:grid-cols-3 border-b border-brand-black h-[60vh]">
         <div className="border-r border-brand-black overflow-hidden relative group">
           <img src="https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-sm">
             <span className="bg-white border border-brand-black px-4 py-2 font-mono text-xs uppercase">Lookbook 01</span>
           </div>
         </div>
         <div className="border-r border-brand-black overflow-hidden relative group">
           <img src="https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-sm">
             <span className="bg-white border border-brand-black px-4 py-2 font-mono text-xs uppercase">Lookbook 02</span>
           </div>
         </div>
         <div className="overflow-hidden relative group">
           <img src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-sm">
             <span className="bg-white border border-brand-black px-4 py-2 font-mono text-xs uppercase">Lookbook 03</span>
           </div>
         </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 bg-brand-white text-center">
        <h2 className="font-display font-bold text-6xl md:text-8xl uppercase mb-8">
           Ready to <br/><span className="text-outline">Shine?</span>
        </h2>
        <Link to="/booking">
          <Button>Book Appointment</Button>
        </Link>
      </section>
    </div>
  );
};

export default Home;