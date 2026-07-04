import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 1. Ép Vite tự động bù đuôi file .js/.jsx để sửa hoàn toàn lỗi build trên Railway
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // Đồng bộ về cổng 5000 của backend kế toán
        changeOrigin: true,
      }
    }
  }
});