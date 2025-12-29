<template>
  <div class="family-intro">
    <div class="content">
      <h1>🌟 家庭成长银行</h1>
      <p>把好习惯变成一场游戏，让成长看得见！</p>
      
      <div class="features">
        <div class="item">🎯 设定目标</div>
        <div class="item">📈 积累积分</div>
        <div class="item">🎁 兑换奖励</div>
      </div>

      <el-button type="primary" size="large" round class="enter-btn" @click="$router.push('/family/dashboard')">
        进入我的积分看板 ->
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.family-intro {
  height: 100vh;
  /* 使用温馨的米色/暖色渐变背景 */
  background: linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}
.content {
  background: rgba(255, 255, 255, 0.8);
  padding: 60px;
  border-radius: 30px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}
h1 { font-size: 3rem; color: #333; margin-bottom: 20px; font-weight: 800; }
p { font-size: 1.5rem; color: #666; margin-bottom: 50px; }
.features { display: flex; gap: 30px; justify-content: center; margin-bottom: 60px; }
.item { 
  background: #fff; 
  padding: 20px 40px; 
  border-radius: 20px; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
  font-weight: bold; 
  color: #f59e0b; 
  font-size: 1.2rem;
}
.enter-btn { 
  font-weight: 800; 
  padding: 30px 60px; 
  font-size: 1.4rem; 
  border-radius: 50px;
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.3);
  transition: transform 0.2s;
}
.enter-btn:hover {
  transform: translateY(-5px);
}
</style>