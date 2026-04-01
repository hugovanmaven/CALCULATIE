import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/static/calc/',
  server: {
    proxy: {
      '/calculatie/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/calculatie/, ''),
      },
    },
  },
})
