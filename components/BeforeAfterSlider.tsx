import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface BeforeAfterProps {
  beforeImage: string;
  afterImage: string;
  label?: string;
}

const BeforeAfterSlider: React.FC<BeforeAfterProps> = ({ beforeImage, afterImage, label }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [animating, setAnimating] = useState(false);
  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const allLoaded = beforeLoaded && afterLoaded;

  const calculatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * 100;
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging.current) return;
    const pos = calculatePosition(e.clientX);
    if (pos !== null) {
      setAnimating(true);
      setSliderPosition(pos);
      setHasInteracted(true);
      setTimeout(() => setAnimating(false), 400);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    setAnimating(false);
    setHasInteracted(true);
    const pos = calculatePosition(e.clientX);
    if (pos !== null) setSliderPosition(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      const pos = calculatePosition(e.clientX);
      if (pos !== null) setSliderPosition(pos);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    setAnimating(false);
    setHasInteracted(true);
    const pos = calculatePosition(e.touches[0].clientX);
    if (pos !== null) setSliderPosition(pos);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging.current) {
      const pos = calculatePosition(e.touches[0].clientX);
      if (pos !== null) setSliderPosition(pos);
    }
  };

  useEffect(() => {
    const stop = () => { isDragging.current = false; };
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
    };
  }, []);

  const transitionStyle = animating
    ? 'transition-[left,width] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]'
    : '';

  return (
    <div
      ref={containerRef}
      className="group relative h-[380px] w-full select-none overflow-hidden rounded-2xl bg-neutral-100 sm:h-[440px] lg:h-[500px]"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { isDragging.current = false; }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { isDragging.current = false; }}
    >
      {/* After Image (full background) */}
      <img
        src={afterImage}
        alt="After"
        onLoad={() => setAfterLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${afterLoaded ? 'opacity-100' : 'opacity-0'}`}
        draggable={false}
      />
      <div className={`absolute right-4 top-4 z-20 rounded-md bg-brand-black/80 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white transition-all duration-500 ${allLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        After
      </div>

      {/* Before Image (clipped) */}
      <div
        className={`absolute inset-0 h-full overflow-hidden ${transitionStyle}`}
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeImage}
          alt="Before"
          onLoad={() => setBeforeLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${beforeLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ minWidth: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100vw' }}
          draggable={false}
        />
        <div className={`absolute left-4 top-4 z-20 rounded-md border border-black/[0.06] bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-black transition-all duration-500 ${allLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
          Before
        </div>
      </div>

      {/* Divider line */}
      <div
        className={`absolute bottom-0 top-0 z-10 w-[2px] bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.15)] ${transitionStyle}`}
        style={{ left: `${sliderPosition}%` }}
      />

      {/* Slider Handle */}
      <div
        className={`absolute bottom-0 top-0 z-10 flex w-0 cursor-ew-resize items-center justify-center ${transitionStyle}`}
        style={{ left: `${sliderPosition}%` }}
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-brand-black text-white shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_4px_28px_rgba(0,0,0,0.4)] ${!hasInteracted ? 'slider-handle-pulse' : ''}`}>
          <ChevronsLeftRight className="h-5 w-5" />
        </div>
      </div>

      {/* Label badge */}
      {label && (
        <div className={`pointer-events-none absolute bottom-4 left-4 z-20 rounded-lg border border-black/[0.04] bg-white/90 backdrop-blur-sm px-4 py-2 transition-all duration-500 ${allLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <span className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand-black sm:text-base">
            {label}
          </span>
        </div>
      )}

      {/* Loading placeholder */}
      {!allLoaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-100">
          <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-brand-mclaren animate-spin" />
        </div>
      )}
    </div>
  );
};

export default BeforeAfterSlider;
