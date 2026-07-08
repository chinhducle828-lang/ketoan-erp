/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React from 'react';

export default function ResponsiveContainer({ children, className = '' }) {
  return (
    <div className={`w-full max-w-[min(100%,1600px)] mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
