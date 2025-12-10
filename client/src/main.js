import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 引入路由
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 👇 1. 引入 axios
import axios from 'axios'

const app = createApp(App)

// 👇 2. 全局配置 Axios 的 BaseURL (这是修复的关键！)
// 逻辑：读取 Cloudflare 里的环境变量。如果没有(比如本地开发)，就用空字符串(会自动走本地代理)
// 注意：为了防止双重 '/api'，我们做一个简单的替换处理
const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
if (apiUrl) {
  // 如果环境变量里填了 ".../api"，但你的代码请求也写了 "/api/login"，
  // 为了防止拼成 "/api/api/login"，我们把环境变量末尾的 /api 去掉，只留域名
  axios.defaults.baseURL = apiUrl.replace(/\/api$/, '');
}

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(router) // 使用路由
app.use(ElementPlus)
app.mount('#app')