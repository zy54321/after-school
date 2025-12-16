<template>
  <div class="portal-home">
    <h1>🚀 托管班数字化中台</h1>
    <p>Educare Operational Platform</p>
    
    <div class="card-container">
      <div class="card" @click="$router.push('/login?redirect=/system/dashboard')">
        <h2>🏫 教务管理系统</h2>
        <p>日常运营、学员管理、财务流水</p>
        <button>进入工作台 -></button>
      </div>

      <div class="card" @click="$router.push('/login?redirect=/strategy/map')">
        <h2>🗺️ 战略作战地图</h2>
        <p>市场拓客、竞对分析、选址决策</p>
        <button class="dark-btn">进入指挥室 -></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ... (保持原有 CSS) */
.portal-home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}
h1 { font-size: 2.5rem; margin-bottom: 10px; color: #333; }
.card-container { display: flex; gap: 40px; margin-top: 50px; }
.card {
  background: white;
  padding: 40px;
  border-radius: 16px;
  width: 300px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  text-align: center;
}
.card:hover { transform: translateY(-10px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
h2 { color: #409EFF; margin-bottom: 15px; }
button {
  margin-top: 20px;
  padding: 10px 20px;
  border: none;
  background: #409EFF;
  color: white;
  border-radius: 6px;
  cursor: pointer;
}
.dark-btn { background: #0f172a; }
</style>