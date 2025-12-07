<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <h2>托管班管理系统</h2>
        </div>
      </template>
      
      <el-form :model="loginForm" :rules="rules" ref="loginFormRef" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input 
            v-model="loginForm.username" 
            placeholder="用户名" 
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="密码" 
            prefix-icon="Lock" 
            show-password
            size="large"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin" size="large">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        // 调用后端登录接口
        const res = await axios.post('/api/login', loginForm)
        
        if (res.data.code === 200) {
          ElMessage.success('登录成功')
          
          // 核心：把 Token 或用户信息存到浏览器
          localStorage.setItem('user_token', 'logged_in') 
          localStorage.setItem('user_info', JSON.stringify(res.data.data))
          
          // 跳转回首页
          router.push('/')
        } else {
          ElMessage.error(res.data.msg || '登录失败')
        }
      } catch (err) {
        console.error(err)
        ElMessage.error('服务器连接失败')
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #2d3a4b; /* 深色背景，显得专业 */
}
.login-card {
  width: 400px;
}
.login-header h2 {
  text-align: center;
  margin: 0;
  color: #333;
}
.login-btn {
  width: 100%;
}
</style>