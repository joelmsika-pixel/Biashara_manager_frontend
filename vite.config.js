import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const packageMetadata = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const buildVersion = process.env.BUILD_VERSION || `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-')}Z`

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    __WEB_APP_VERSION__: JSON.stringify(packageMetadata.version),
    __WEB_APP_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
})
