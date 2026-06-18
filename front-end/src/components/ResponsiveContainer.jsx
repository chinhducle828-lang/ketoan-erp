import React from 'react';

export default function ResponsiveContainer({ children, className = '' }) {
  return (
    <div className={`w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
