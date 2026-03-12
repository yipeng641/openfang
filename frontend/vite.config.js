import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const proxyTarget = env.VITE_OPENFANG_PROXY_TARGET || 'http://127.0.0.1:4200'

  return {
    base: '/app/',
    plugins: [vue()],
    build: {
      outDir: resolve(__dirname, '../crates/openfang-api/static/app'),
      emptyOutDir: true,
      manifest: true,
    },
    server: {
      port: 5173,
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
        '/legacy': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
