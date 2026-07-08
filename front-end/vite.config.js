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

function getApiProxyTarget() {
  const rawTarget = (
    process.env.VITE_PROXY_TARGET ||
    process.env.VITE_BACKEND_URL ||
    process.env.VITE_API_BASE_URL ||
    'http://127.0.0.1:5000'
  ).trim();

  if (!rawTarget) return 'http://127.0.0.1:5000';

  if (/^https?:\/\//i.test(rawTarget)) {
    return rawTarget.replace(/\/api\/?$/, '');
  }

  return rawTarget;
}

const apiProxyTarget = getApiProxyTarget();

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
        target: apiProxyTarget,
        changeOrigin: true,
      }
    }
  },
  preview: {
    allowedHosts: ['ketoanonline.up.railway.app', '.railway.app'],
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      }
    }
  }
});
