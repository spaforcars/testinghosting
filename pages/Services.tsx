import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import { Service } from '../types';
import { ArrowDown } from 'lucide-react';

const Services: React.FC = () => {
  const services: Service[] = [
    {
      id: '1',
      title: 'The Refresh',
      description: 'A premium maintenance wash and light interior detail. Perfect for regular upkeep.',
      category: 'Detailing',
      price: '$95+',
      duration: '1.5 Hours',
      features: ['Foam Hand Wash', 'Wheel Cleaning', 'Vacuum & Wipe Down', 'Tire Dressing', 'Spray Wax'],
      image: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: '2',
      title: 'Signature Detail',
      description: 'Our most popular package. Complete interior deep clean and exterior gloss enhancement.',
      category: 'Detailing',
      price: '$295+',
      duration: '4 Hours',
      features: ['Everything in Refresh', 'Clay Bar Treatment', 'Machine Polish', 'Leather Conditioning', 'Steam Clean', '6-Month Sealant'],
      image: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: '3',
      title: 'Ceramic Coating',
      description: 'The ultimate protection for your paint. Hardens to form a glass-like shield.',
      category: 'Protection',
      price: '$800+',
      duration: '1 Day',
      features: ['3-Year Warranty', 'Paint Correction', 'Extreme Hydrophobicity', 'UV Protection', 'Self-Cleaning'],
      image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: '4',
      title: 'PPF Front',
      description: 'Invisible physical protection against rock chips and road debris.',
      category: 'Protection',
      price: '$1,800+',
      duration: '2 Days',
      features: ['10-Year Warranty', 'Self-Healing Film', 'Covers Bumper/Hood', 'Invisible Edges', 'Stain Resistant'],
      image: 'https://images.unsplash.com/photo-1623886567540-3b242e232766?auto=format&fit=crop&q=80&w=800'
    }
  ];

  return (
    <div className="bg-brand-white">
      {/* Page Header */}
      <div className="py-24 border-b border-brand-black px-4">
         <div className="container mx-auto">
            <h1 className="text-[12vw] leading-none font-display font-bold uppercase">Services</h1>
            <div className="flex justify-between items-end mt-8">
               <p className="font-mono text-sm uppercase max-w-md">
                 Curated treatments for the discerning owner. <br/> Select a package below to view details.
               </p>
               <ArrowDown className="w-8 h-8 animate-bounce hidden md:block" />
            </div>
         </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b border-brand-black flex overflow-x-auto">
         {['All', 'Detailing', 'Protection', 'Restoration'].map((f, i) => (
           <button key={f} className={`px-8 py-4 border-r border-brand-black font-mono text-xs uppercase hover:bg-brand-black hover:text-white transition-colors whitespace-nowrap ${i === 0 ? 'bg-brand-black text-white' : ''}`}>
             {f}
           </button>
         ))}
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1">
        {services.map((service, index) => (
          <div key={service.id} className="grid grid-cols-1 md:grid-cols-2 border-b border-brand-black min-h-[50vh] group">
            {/* Image Side - Alternate sides */}
            <div className={`relative overflow-hidden border-b md:border-b-0 md:border-r border-brand-black ${index % 2 !== 0 ? 'md:order-2 md:border-r-0 md:border-l' : ''}`}>
              <img src={service.image} alt={service.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 saturate-0 group-hover:saturate-100" />
              <div className="absolute top-0 left-0 bg-brand-white border-b border-r border-brand-black px-4 py-2 font-mono text-xs uppercase">
                 {service.category}
              </div>
            </div>

            {/* Content Side */}
            <div className={`p-8 md:p-16 flex flex-col justify-between ${index % 2 !== 0 ? 'md:order-1' : ''}`}>
               <div>
                  <div className="flex justify-between items-start mb-6">
                     <h2 className="font-display font-bold text-4xl uppercase leading-none">{service.title}</h2>
                     <span className="font-mono text-xl">{service.price}</span>
                  </div>
                  <p className="font-sans text-lg mb-8 max-w-md">{service.description}</p>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-8">
                     {service.features.map((feat, i) => (
                       <div key={i} className="flex items-start gap-2 font-mono text-xs text-gray-600 uppercase">
                         <span>+</span> {feat}
                       </div>
                     ))}
                  </div>
               </div>
               
               <div className="flex items-center justify-between mt-8 pt-8 border-t border-gray-200">
                  <span className="font-mono text-xs uppercase text-gray-500">Duration: {service.duration}</span>
                  <Link to={`/booking?service=${service.id}`}>
                    <Button>Book Now</Button>
                  </Link>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Services;