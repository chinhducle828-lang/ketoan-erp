/**
 * GlobalAppContext.jsx - Context chứa entity_id, reporting_standard, base_currency
 * Dùng cho toàn bộ SDUI engine
 */

import { createContext, useContext, useState } from 'react';

const GlobalAppContext = createContext();

export function GlobalAppProvider({ children }) {
  const [context, setContext] = useState({
    currentEntityId: null,
    reportingStandard: 'VAS',
    baseCurrency: 'VND',
    dateFormat: 'DD/MM/YYYY',
    locale: 'vi-VN'
  });

  const updateContext = (updates) => setContext(prev => ({ ...prev, ...updates }));

  return (
    <GlobalAppContext.Provider value={{ ...context, updateContext }}>
      {children}
    </GlobalAppContext.Provider>
  );
}

export const useGlobalApp = () => useContext(GlobalAppContext);