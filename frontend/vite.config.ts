import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Needed for Docker
    proxy: {
      '/api': {
        target: 'http://web:8000', // Use Docker service name
        changeOrigin: true,
      }
    }
  }
})
