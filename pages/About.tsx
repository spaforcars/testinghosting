import React from 'react';
import { Award, Users, Heart } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="bg-brand-white">
      <div className="py-24 px-4 border-b border-brand-black bg-brand-gray">
         <div className="container mx-auto px-4 text-center max-w-4xl">
           <h1 className="text-[10vw] leading-none font-display font-bold uppercase mb-8">More Than<br/>Just a Wash.</h1>
           <p className="font-mono text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
             We founded <strong>Spa for Cars</strong> with a simple mission: to treat every vehicle like a masterpiece. 
             What started as a passion project in a small garage has evolved into the city's premier automotive sanctuary.
           </p>
         </div>
      </div>

      <div className="container mx-auto px-4 py-24">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div className="relative">
            <div className="border border-brand-black p-2">
              <img 
                src="/client-images/IMG_2417.PNG" 
                alt="Detailing Team" 
                className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-500"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-brand-black text-white px-4 py-2 font-mono text-xs font-bold uppercase">
               Est. 2018
            </div>
          </div>
          
          <div className="space-y-12">
            <div>
              <h2 className="font-display font-bold text-4xl uppercase mb-6">The Evolution</h2>
              <p className="font-sans text-lg leading-relaxed">
                Formerly "Quick Shine Auto", we realized our level of care went far beyond a quick shine. 
                We were performing surgery on paint, therapy on leather, and restoration on wheels. 
                The name <strong>Spa for Cars</strong> reflects the commitment to therapeutic rejuvenation for your vehicle.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
               <div className="border border-brand-black p-6 hover:bg-brand-black hover:text-white transition-colors group">
                 <div className="flex items-center gap-4 mb-3">
                   <Award className="w-6 h-6"/>
                   <h4 className="font-display font-bold text-xl uppercase">Certified Pros</h4>
                 </div>
                 <p className="font-mono text-xs text-gray-500 group-hover:text-gray-300">IDA Certified Detailers & Ceramic Pro Installers.</p>
               </div>
               
               <div className="border border-brand-black p-6 hover:bg-brand-black hover:text-white transition-colors group">
                 <div className="flex items-center gap-4 mb-3">
                   <Heart className="w-6 h-6"/>
                   <h4 className="font-display font-bold text-xl uppercase">Passion Driven</h4>
                 </div>
                 <p className="font-mono text-xs text-gray-500 group-hover:text-gray-300">We treat your 2005 Honda with the same respect as a 2024 Ferrari.</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
