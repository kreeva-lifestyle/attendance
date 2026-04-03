import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Plugin to copy index.html → 404.html for GitHub Pages SPA routing
const spa404Plugin = () => ({
  name: 'spa-404',
  closeBundle: async () => {
    const fs = await import('fs')
    const dist = resolve('dist')
    fs.copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
  }
})

export default defineConfig({
  plugins: [react(), spa404Plugin()],
  base: '/',
  resolve: {
    alias: {
      'sheetjs': 'xlsx'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
          'vendor-xlsx': ['xlsx'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
})
