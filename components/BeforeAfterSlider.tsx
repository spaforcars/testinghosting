import React, { useState, useRef, useEffect } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface BeforeAfterProps {
  beforeImage: string;
  afterImage: string;
  label?: string;
}

const BeforeAfterSlider: React.FC<BeforeAfterProps> = ({ beforeImage, afterImage, label }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  };

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      handleMove(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div className="relative w-full h-[500px] overflow-hidden cursor-ew-resize group select-none border-b border-r border-brand-black bg-brand-gray"
         ref={containerRef}
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onTouchMove={handleTouchMove}
    >
      {/* After Image (Background) */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center"
        style={{ backgroundImage: `url(${afterImage})` }}
      >
         <div className="absolute top-4 right-4 bg-brand-black text-white text-xs font-mono font-bold px-3 py-1 uppercase tracking-wider">
          After
         </div>
      </div>

      {/* Before Image (Clipped) */}
      <div 
        className="absolute inset-0 h-full bg-cover bg-center border-r-2 border-brand-white"
        style={{ 
          backgroundImage: `url(${beforeImage})`,
          width: `${sliderPosition}%` 
        }}
      >
        <div className="absolute top-4 left-4 bg-white border border-brand-black text-brand-black text-xs font-mono font-bold px-3 py-1 uppercase tracking-wider">
          Before
        </div>
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center z-10"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="w-12 h-12 bg-brand-black flex items-center justify-center -ml-[2px] text-white transition-transform hover:scale-110 border-2 border-white">
          <ChevronsLeftRight className="w-6 h-6" />
        </div>
      </div>
      
      {/* Label */}
      {label && (
        <div className="absolute bottom-6 left-6 bg-white border border-brand-black px-6 py-3 pointer-events-none z-20">
          <span className="font-display font-bold uppercase text-lg tracking-wide text-brand-black">{label}</span>
        </div>
      )}
    </div>
  );
};

export default BeforeAfterSlider;