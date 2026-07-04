import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function getSafeBase() {
  const rawBase = (process.env.VITE_BASE_URL || '/').trim();

  if (!rawBase || rawBase === '/') return '/';

  if (/^https?:\/\//i.test(rawBase)) {
    try {
      const parsed = new URL(rawBase);
      const pathname = parsed.pathname || '/';
      return pathname.endsWith('/') ? pathname : `${pathname}/`;
    } catch {
      return '/';
    }
  }

  if (rawBase.startsWith('/')) {
    return rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  }

  return '/';
}

export default defineConfig({
  base: getSafeBase(),
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']
  }
});
