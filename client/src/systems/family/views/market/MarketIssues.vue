<template>
  <div class="market-issues">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">问题关注</span>
    </nav>

    <header class="page-header">
      <h1>
        <span class="header-icon">⚠️</span>
        问题关注
      </h1>
      <p>追踪家庭成员的行为问题，促进成长</p>
    </header>

    <!-- 问题列表 -->
    <div class="issues-list" v-if="issues.length > 0">
      <div 
        v-for="issue in issues" 
        :key="issue.id" 
        class="issue-card"
        :class="getSeverityClass(issue.attention_score)"
      >
        <div class="issue-header">
          <div class="issue-title">
            <h3>{{ issue.title }}</h3>
            <div class="issue-tags">
              <span v-for="tag in issue.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="attention-score">
            <div class="score-value">{{ issue.attention_score }}</div>
            <div class="score-label">关注度</div>
          </div>
        </div>

        <div class="issue-meta">
          <span class="meta-item">
            <span class="meta-icon">👤</span>
            {{ issue.owner_name }}
          </span>
          <span class="meta-item">
            <span class="meta-icon">📅</span>
            {{ formatTime(issue.created_at) }}
          </span>
          <span class="meta-item">
            <span class="meta-icon">🔄</span>
            {{ issue.occurrence_count || 0 }} 次发生
          </span>
        </div>

        <div class="issue-status" :class="issue.status">
          {{ getStatusLabel(issue.status) }}
        </div>

        <div class="issue-actions">
          <button class="action-btn" @click="recordOccurrence(issue)">
            记录发生
          </button>
          <button class="action-btn secondary" @click="viewDetail(issue)">
            查看详情
          </button>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">✅</div>
      <p>暂无需要关注的问题</p>
    </div>

    <div class="loading-state" v-if="loading">
      加载中...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const loading = ref(false);
const issues = ref([]);

// 加载问题列表
const loadIssues = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/issues');
    
    if (res.data?.code === 200) {
      issues.value = res.data.data?.issues || [];
    }
  } catch (err) {
    console.error('加载问题列表失败:', err);
  } finally {
    loading.value = false;
  }
};

// 格式化时间
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
};

// 获取严重程度样式
const getSeverityClass = (score) => {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'warning';
  return 'normal';
};

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    active: '关注中',
    resolved: '已解决',
    fading: '淡化中',
  };
  return labels[status] || status;
};

// 记录发生
const recordOccurrence = async (issue) => {
  const note = prompt('记录备注（可选）:');
  
  try {
    const res = await axios.post(`/api/v2/issues/${issue.id}/occurrence`, {
      note: note || undefined,
    });
    
    if (res.data?.code === 200) {
      alert('记录成功');
      loadIssues();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '记录失败');
  }
};

// 查看详情
const viewDetail = (issue) => {
  // TODO: 跳转到详情页
  alert(`查看问题 #${issue.id} 详情`);
};

onMounted(() => {
  loadIssues();
});
</script>

<style scoped>
.market-issues {
  color: #fff;
}

.breadcrumb {
  margin-bottom: 24px;
  font-size: 14px;
}

.breadcrumb a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: #fff;
}

.breadcrumb .separator {
  margin: 0 8px;
  color: rgba(255, 255, 255, 0.4);
}

.breadcrumb .current {
  color: #fff;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
}

.header-icon {
  font-size: 32px;
}

.page-header p {
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

/* 问题列表 */
.issues-list {
  display: grid;
  gap: 16px;
}

.issue-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
}

.issue-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.issue-card.critical {
  border-left: 4px solid #ff4d4d;
}

.issue-card.warning {
  border-left: 4px solid #ffc107;
}

.issue-card.normal {
  border-left: 4px solid #38ef7d;
}

.issue-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.issue-title h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
}

.issue-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.attention-score {
  text-align: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  min-width: 80px;
}

.score-value {
  font-size: 28px;
  font-weight: 700;
  color: #fc4a1a;
}

.issue-card.warning .score-value {
  color: #ffc107;
}

.issue-card.normal .score-value {
  color: #38ef7d;
}

.score-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.issue-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.meta-icon {
  font-size: 14px;
}

.issue-status {
  display: inline-block;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  margin-bottom: 16px;
}

.issue-status.active {
  background: rgba(252, 74, 26, 0.2);
  color: #fc4a1a;
}

.issue-status.fading {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.issue-status.resolved {
  background: rgba(56, 239, 125, 0.2);
  color: #38ef7d;
}

.issue-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  background: linear-gradient(135deg, #fc4a1a, #f7b733);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: scale(1.02);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 空状态 & 加载 */
.empty-state, .loading-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}
</style>
