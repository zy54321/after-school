import { createApp } from 'vue'
import './css/style.css'
import App from './App.vue'
import router from './router' // 引入路由
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 👇 引入 axios
import axios from 'axios'

// 👇 引入 i18n 相关
import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import enLocale from './locales/en'

// 👇 引入权限检查函数
import { hasPermission } from './utils/auth';

const app = createApp(App)

// 👇 创建 i18n 实例
const i18n = createI18n({
  legacy: false, // 必须设置 false 才能在 Composition API 中使用
  locale: localStorage.getItem('lang') || 'zh', // 优先读取缓存，默认中文
  fallbackLocale: 'en', // 缺省语言
  messages: {
    zh,
    en: enLocale
  }
})

// 👇 全局配置 Axios 的 BaseURL (这是修复的关键！)
// 逻辑：读取 Cloudflare 里的环境变量。如果没有(比如本地开发)，就用空字符串(会自动走本地代理)
// 注意：为了防止双重 '/api'，我们做一个简单的替换处理
const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
if (apiUrl) {
  // 如果环境变量里填了 ".../api"，但你的代码请求也写了 "/api/login"，
  // 为了防止拼成 "/api/api/login"，我们把环境变量末尾的 /api 去掉，只留域名
  axios.defaults.baseURL = apiUrl.replace(/\/api$/, '');
}
// 👇👇👇 关键代码！(开启跨域携带 Cookie) 👇👇👇
axios.defaults.withCredentials = true;

// ⭐⭐⭐ 全局图片处理函数 ⭐⭐⭐
app.config.globalProperties.$img = (path) => {
  if (!path) return '';
  // 如果已经是完整链接(如 http 开头)或是本地预览的 blob，直接返回
  if (path.startsWith('http') || path.startsWith('blob:')) return path;
  
  // 拼接后端地址 (利用上面定义好的 serverUrl 逻辑)
  // 注意：我们需要重新获取一次 apiUrl 变量，或者复用上面的逻辑
  // 为了简单稳妥，这里直接复用 axios.defaults.baseURL
  const baseUrl = axios.defaults.baseURL || '';
  return baseUrl ? `${baseUrl}${path}` : path;
}

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.directive('auth', {
  mounted(el, binding) {
    const { value } = binding; // 获取指令的值，例如 'edu:student:delete'
    if (value && typeof value === 'string') {
      if (!hasPermission(value)) {
        // ❌ 如果没有权限，移除该元素
        el.parentNode && el.parentNode.removeChild(el);
      }
    } else {
      throw new Error(`v-auth 需要传入权限 Key 字符串，例如 v-auth="'edu:student:delete'"`);
    }
  }
});

app.use(router) // 使用路由
app.use(ElementPlus)
app.use(i18n) // 👈 挂载 i18n
app.mount('#app')
