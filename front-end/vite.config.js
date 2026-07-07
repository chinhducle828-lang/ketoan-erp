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
    // 1. Ép Vite tự động bù đuôi file .js/.jsx để sửa hoàn toàn lỗi build trên Railway
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    allowedHosts: ['ketoanonline.up.railway.app', '.railway.app'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // Đồng bộ về cổng 5000 của backend kế toán
        changeOrigin: true,
      }
    }
  },
  preview: {
    allowedHosts: ['ketoanonline.up.railway.app', '.railway.app']
  }
});
