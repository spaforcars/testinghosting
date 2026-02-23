import React from 'react';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import { ArrowDown } from 'lucide-react';

const Gallery: React.FC = () => {
  const transformations = [
    { 
      label: "Paint Correction",
      before: "https://images.unsplash.com/photo-1582239634289-e58f0003c27e?auto=format&fit=crop&q=80&w=800&sat=-100&bri=-20", // Simulated dull/dirty
      after: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800" 
    },
    { 
      label: "Interior Restoration", 
      before: "https://images.unsplash.com/photo-1517056285-d857038d810a?auto=format&fit=crop&q=80&w=800&sat=-50",
      after: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=800" 
    },
    { 
      label: "Ceramic Coating", 
      before: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800&blur=2",
      after: "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=800" 
    },
    { 
      label: "Engine Bay Detail", 
      before: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=800&sepia=100", 
      after: "https://images.unsplash.com/photo-1562519819-016930d6756b?auto=format&fit=crop&q=80&w=800" 
    },
    { 
      label: "Headlight Restoration", 
      before: "https://images.unsplash.com/photo-1459603677915-a62079ffd030?auto=format&fit=crop&q=80&w=800&blur=5", 
      after: "https://images.unsplash.com/photo-1605515298946-d062f2e9da53?auto=format&fit=crop&q=80&w=800" 
    },
    { 
      label: "Wheel Polishing", 
      before: "https://images.unsplash.com/photo-1563720360172-67b8f3dcebb0?auto=format&fit=crop&q=80&w=800&sat=-100", 
      after: "https://images.unsplash.com/photo-1580273916550-e323be2ebccd?auto=format&fit=crop&q=80&w=800" 
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