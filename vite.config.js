import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/brightdata': {
        target: 'https://api.brightdata.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/brightdata/, ''),
      },
      '/api/arcgis': {
        target: 'https://services7.arcgis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/arcgis/, ''),
      }
    }
  }
})
