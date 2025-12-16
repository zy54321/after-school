<template>
  <div class="strategy-map-container">
    <div class="placeholder-content">
      <h1>🌍 战略作战地图 (Building...)</h1>
      <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
    </div>
  </div>
</template>

<style scoped>
.strategy-map-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #1e293b;
}
h1 { color: #94a3b8; margin-bottom: 20px; }
</style>