import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/summary': 'http://127.0.0.1:5000',
      '/profiles': 'http://127.0.0.1:5000',
      '/health': 'http://127.0.0.1:5000',
    },
  },
  preview: {
    host: true,
  },
})
