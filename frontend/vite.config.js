import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    proxy: {
      // REST API requests
      '/auth':      { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/calls':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/users':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/contacts':  { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/knowledge': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/stats':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/analytics': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/settings':  { target: 'http://127.0.0.1:8000', changeOrigin: true },
      // WebSocket proxy — /ws → ws://127.0.0.1:8000/ws
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
