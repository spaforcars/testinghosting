import React from 'react';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import { ArrowDown } from 'lucide-react';

const Gallery: React.FC = () => {
  const transformations = [
    { 
      label: "Paint Correction",
      before: "/client-images/IMG_2414.PNG",
      after: "/client-images/IMG_2415.PNG" 
    },
    { 
      label: "Interior Restoration", 
      before: "/client-images/IMG_2460_before.PNG",
      after: "/client-images/IMG_2460_after.PNG" 
    },
    { 
      label: "Steering Restoration", 
      before: "/client-images/IMG_2439_before.PNG",
      after: "/client-images/IMG_2439_after.PNG" 
    },
    { 
      label: "Leather Seat Restoration", 
      before: "/client-images/IMG_2445_before.PNG", 
      after: "/client-images/IMG_2445_after.PNG" 
    },
    { 
      label: "Trim Refinement", 
      before: "/client-images/IMG_2421_before.PNG", 
      after: "/client-images/IMG_2421_after.PNG" 
    },
    { 
      label: "Panel Correction", 
      before: "/client-images/IMG_2418_before.PNG", 
      after: "/client-images/IMG_2418_after.PNG" 
    },
  ];

  return (
    <div className="bg-brand-white min-h-screen">
      <div className="py-24 border-b border-brand-black px-4">
        <div className="container mx-auto">
           <h1 className="text-[12vw] leading-none font-display font-bold uppercase">Results</h1>
           <div className="flex justify-between items-end mt-8">
              <p className="font-mono text-sm uppercase max-w-md">
                Evidence of execution. <br/> Drag the slider to reveal the transformation.
              </p>
              <ArrowDown className="w-8 h-8 animate-bounce hidden md:block" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 border-b border-brand-black bg-brand-black border-l">
        {transformations.map((item, i) => (
          <BeforeAfterSlider 
            key={i}
            beforeImage={item.before}
            afterImage={item.after}
            label={item.label}
          />
        ))}
      </div>
      
      <div className="p-24 text-center">
        <p className="font-display font-bold text-4xl uppercase mb-4">Your car could be next.</p>
      </div>
    </div>
  );
};

export default Gallery;
