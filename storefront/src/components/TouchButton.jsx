/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React from 'react';

/**
 * Touch-Optimized Button Component
 * Ensures minimum 44x44px touch target for mobile ergonomics
 * 
 * @param {React.ReactNode} children - Button content
 * @param {Function} onClick - Click handler
 * @param {string} variant - 'primary' | 'secondary' | 'danger' | 'ghost'
 * @param {boolean} disabled - Disabled state
 * @param {string} className - Additional CSS classes
 */
export default function TouchButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  ...props
}) {
  const baseClasses = 'touch-target font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2';
  
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-400',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 disabled:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-400',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200'
  };

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}