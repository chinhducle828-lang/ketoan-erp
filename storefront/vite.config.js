import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']
  }
});
