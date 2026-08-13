import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    allowedHosts: ['.monkeycode-ai.live']
  },
  build: {
    outDir: 'dist'
  }
})
