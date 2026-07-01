import { useEffect, useState } from 'react';

const getStorage = (storageType = 'sessionStorage') => {
  if (typeof window === 'undefined') return null;
  try {
    return window[storageType];
  } catch {
    return null;
  }
};

export const readPersistedState = (key, fallback, storageType = 'sessionStorage') => {
  const storage = getStorage(storageType);
  if (!storage) {
    return typeof fallback === 'function' ? fallback() : fallback;
  }

  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return typeof fallback === 'function' ? fallback() : fallback;
    }
    return JSON.parse(raw);
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
};

export const writePersistedState = (key, value, storageType = 'sessionStorage') => {
  const storage = getStorage(storageType);
  if (!storage) return;

  if (value === undefined) {
    storage.removeItem(key);
    return;
  }

  storage.setItem(key, JSON.stringify(value));
};

export const usePersistentState = (key, initialValue, storageType = 'localStorage') => {
  const [state, setState] = useState(() => readPersistedState(key, initialValue, storageType));

  useEffect(() => {
    writePersistedState(key, state, storageType);
  }, [key, state, storageType]);

  return [state, setState];
};
