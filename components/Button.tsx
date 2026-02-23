import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'white';
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
  // Brutalist styles: No rounded corners, sharp borders, uppercase text
  const baseStyles = "relative inline-flex items-center justify-center px-8 py-4 font-display font-bold uppercase tracking-widest transition-all duration-200 focus:outline-none border border-brand-black disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-black text-white hover:bg-white hover:text-brand-black",
    secondary: "bg-brand-gray text-brand-black hover:bg-brand-black hover:text-white",
    outline: "bg-transparent text-brand-black hover:bg-brand-black hover:text-white",
    white: "bg-white text-brand-black hover:bg-brand-black hover:text-white border-white" // For dark backgrounds
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