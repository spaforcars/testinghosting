import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'white' | 'black';
  size?: 'default' | 'lg';
  icon?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'default',
  icon = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-full font-sans font-semibold uppercase tracking-[0.12em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mclaren/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeStyles = size === 'lg'
    ? "px-8 py-4 text-[14px]"
    : "px-7 py-3.5 text-[13px]";

  const variants = {
    primary:
      "bg-brand-mclaren text-white hover:bg-[#E86E00] hover:shadow-[0_8px_30px_-6px_rgba(255,122,0,0.4)]",
    secondary:
      "bg-brand-black text-white hover:bg-[#1a1a1a] hover:shadow-lg",
    black:
      "bg-brand-black text-white hover:bg-[#1a1a1a] hover:shadow-lg",
    outline:
      "border border-neutral-300 bg-transparent text-brand-black hover:border-brand-mclaren hover:text-brand-mclaren",
    white:
      "bg-white text-brand-black border border-white/20 hover:bg-neutral-100",
  };

  const widthClass = fullWidth ? "w-full" : "";
  const groupClass = icon ? "group" : "";

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variants[variant]} ${widthClass} ${groupClass} ${className}`}
      {...props}
    >
      {children}
      {icon && (
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      )}
    </button>
  );
};

export default Button;
