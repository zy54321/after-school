import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      // API 接口转发
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 图片资源转发
      '/uploads': {
        target: 'http://localhost:3000', // 转发给后端
        changeOrigin: true,
      }
    }
  }
})