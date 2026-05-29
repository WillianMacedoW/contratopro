import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/pncp': {
        target: 'https://pncp.gov.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pncp/, '/api/consulta'),
        secure: true,
      }
    }
  }
})
