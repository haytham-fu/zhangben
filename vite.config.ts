import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pagesBase = process.env.GITHUB_PAGES === 'true' ? '/zhangben/' : '/'

export default defineConfig({
  base: pagesBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '账本',
        short_name: '账本',
        description: '个人记账对比 PWA · 3500 基础 + 1500 专项',
        theme_color: '#3b82f6',
        background_color: '#dbeafe',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'zh-CN',
        start_url: pagesBase,
        scope: pagesBase,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: pagesBase === '/' ? 'index.html' : `${pagesBase}index.html`,
      },
    }),
  ],
})
