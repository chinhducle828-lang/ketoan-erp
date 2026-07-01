import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Chỉ cần thấy request có /api là tóm lại ngay
      '/api': {
        target: 'http://127.0.0.1:5000', // Ném thẳng sang Backend
        changeOrigin: true,
        // Không cần rewrite nữa vì Backend của bạn đang nhận chuẩn /api/auth/login rồi
      }
    }
  }
});