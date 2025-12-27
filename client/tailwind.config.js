/** @type {import('tailwindcss').Config} */
export default {
  // 1. 指定扫描路径
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  // 2. 关闭样式重置 (安全模式)，保护您的旧系统不乱
  corePlugins: {
    preflight: false, 
  },
  plugins: [],
}