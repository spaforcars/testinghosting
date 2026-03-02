import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'white' | 'black';
  icon?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon = false, 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 font-display text-sm font-semibold uppercase tracking-[0.08em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mclaren/40 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-mclaren text-white shadow-sm hover:bg-orange-600 hover:shadow-md",
    secondary: "bg-brand-black text-white shadow-sm hover:bg-neutral-800 hover:shadow-md",
    black: "bg-brand-black text-white shadow-sm hover:bg-neutral-800 hover:shadow-md",
    outline: "border border-neutral-300 bg-white text-brand-black hover:border-brand-mclaren hover:text-brand-mclaren",
    white: "border border-white/50 bg-white text-brand-black hover:bg-neutral-100"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      <span className="relative flex items-center gap-4 z-10">
        {children}
        {icon && <ArrowRight className="w-5 h-5" />}
      </span>
    </button>
  );
};

export default Button;
