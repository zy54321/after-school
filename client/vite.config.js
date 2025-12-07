import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 指向后端地址
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // 咱们不需要这就留着 /api 前缀
      }
    }
  }
})
