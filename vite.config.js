import { defineConfig } from 'vite'

export default defineConfig({
  base: '/pijush008.github.io/',
  server: {
    allowedHosts: ['.monkeycode-ai.live']
  },
  build: {
    outDir: 'dist'
  }
})
