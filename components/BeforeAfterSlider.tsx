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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      handleMove(e.clientX);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    handleMove(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging.current) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div
      className="group relative h-[380px] w-full select-none overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm sm:h-[440px] lg:h-[500px]"
         ref={containerRef}
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseLeave={() => { isDragging.current = false; }}
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
    >
      {/* After Image (Background) */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center"
        style={{ backgroundImage: `url(${afterImage})` }}
      >
         <div className="absolute right-4 top-4 rounded-md bg-brand-black/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
          After
         </div>
      </div>

      {/* Before Image (Clipped) */}
      <div 
        className="absolute inset-0 h-full border-r-2 border-white/80 bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${beforeImage})`,
          width: `${sliderPosition}%` 
        }}
      >
        <div className="absolute left-4 top-4 rounded-md border border-neutral-200 bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-black">
          Before
        </div>
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute bottom-0 top-0 z-10 flex w-1 cursor-ew-resize items-center justify-center bg-white/90"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="-ml-[2px] flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-brand-black text-white shadow-lg transition-transform group-hover:scale-105">
          <ChevronsLeftRight className="h-5 w-5" />
        </div>
      </div>
      
      {/* Label */}
      {label && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-md border border-neutral-200 bg-white/95 px-4 py-2">
          <span className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand-black sm:text-base">
            {label}
          </span>
        </div>
      )}
    </div>
  );
};

export default BeforeAfterSlider;
