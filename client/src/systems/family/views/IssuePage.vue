<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import { ArrowLeft, Refresh, Plus, Warning, TrendCharts } from '@element-plus/icons-vue';

const router = useRouter();

// ========== 状态 ==========
const loading = ref(false);
const members = ref([]);
const currentMemberId = ref(null);

// 问题数据
const topIssues = ref([]);
const memberIssues = ref([]);
const recentOccurrences = ref([]);

// 弹窗
const showCreateModal = ref(false);
const showOccurrenceModal = ref(false);
const showDetailModal = ref(false);

// 表单
const createForm = reactive({
  title: '',
  description: '',
  icon: '⚠️',
  tags: [],
  severity: 'medium',
  attention_threshold: 5,
});

const occurrenceForm = reactive({
  issueId: null,
  issueTitle: '',
  note: '',
  context: '',
});

const detailData = ref(null);

// ========== 计算属性 ==========
const currentMember = computed(() => {
  return members.value.find((m) => m.id === currentMemberId.value);
});

const tagOptions = ['行为', '学习', '生活', '品德', '时间管理', '自控', '沟通'];
const iconOptions = ['⚠️', '⏰', '📱', '🤥', '😤', '📚', '🎮', '💤', '🍭', '😢'];
const severityOptions = [
  { value: 'low', label: '低', color: '#67c23a' },
  { value: 'medium', label: '中', color: '#e6a23c' },
  { value: 'high', label: '高', color: '#f56c6c' },
  { value: 'critical', label: '紧急', color: '#c45656' },
];

// ========== API 调用 ==========
const loadMembers = async () => {
  try {
    const res = await axios.get('/api/family/init');
    if (res.data.code === 200) {
      members.value = res.data.data.members || [];
      if (members.value.length > 0 && !currentMemberId.value) {
        currentMemberId.value = members.value[0].id;
      }
    }
  } catch (err) {
    console.error('加载成员失败:', err);
  }
};

const loadTopIssues = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/issues/top', {
      params: { limit: 10 },
    });
    if (res.data.code === 200) {
      topIssues.value = res.data.data.issues || [];
    }
  } catch (err) {
    ElMessage.error('加载 Top Issues 失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const loadMemberIssues = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/v2/issues', {
      params: { member_id: currentMemberId.value },
    });
    if (res.data.code === 200) {
      memberIssues.value = res.data.data.issues || [];
    }
  } catch (err) {
    console.error('加载成员问题失败:', err);
  }
};

const loadRecentOccurrences = async () => {
  try {
    const res = await axios.get('/api/v2/issues/occurrences', {
      params: { limit: 10 },
    });
    if (res.data.code === 200) {
      recentOccurrences.value = res.data.data.occurrences || [];
    }
  } catch (err) {
    console.error('加载发生记录失败:', err);
  }
};

const createIssue = async () => {
  if (!createForm.title.trim()) {
    return ElMessage.warning('请输入问题标题');
  }

  loading.value = true;
  try {
    const res = await axios.post('/api/v2/issues', {
      owner_member_id: currentMemberId.value,
      title: createForm.title,
      description: createForm.description,
      icon: createForm.icon,
      tags: createForm.tags,
      severity: createForm.severity,
      attention_threshold: createForm.attention_threshold,
    });
    if (res.data.code === 200) {
      ElMessage.success('问题创建成功');
      showCreateModal.value = false;
      resetCreateForm();
      await loadMemberIssues();
      await loadTopIssues();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '创建失败');
  } finally {
    loading.value = false;
  }
};

const openOccurrenceModal = (issue) => {
  occurrenceForm.issueId = issue.id;
  occurrenceForm.issueTitle = issue.title;
  occurrenceForm.note = '';
  occurrenceForm.context = '';
  showOccurrenceModal.value = true;
};

const recordOccurrence = async () => {
  loading.value = true;
  try {
    const res = await axios.post(`/api/v2/issues/${occurrenceForm.issueId}/occurrence`, {
      note: occurrenceForm.note,
      context: occurrenceForm.context,
      reporter_member_id: currentMemberId.value,
    });
    if (res.data.code === 200) {
      const result = res.data.data;
      let msg = result.msg;
      if (result.isAlert) {
        msg += ' ⚠️ 已达关注阈值！';
      }
      ElMessage.success(msg);
      showOccurrenceModal.value = false;
      await loadMemberIssues();
      await loadTopIssues();
      await loadRecentOccurrences();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '记录失败');
  } finally {
    loading.value = false;
  }
};

const openDetailModal = async (issue) => {
  loading.value = true;
  try {
    const res = await axios.get(`/api/v2/issues/${issue.id}`);
    if (res.data.code === 200) {
      detailData.value = res.data.data;
      showDetailModal.value = true;
    }
  } catch (err) {
    ElMessage.error('获取详情失败');
  } finally {
    loading.value = false;
  }
};

const decayAllScores = async () => {
  try {
    await ElMessageBox.confirm('确定要衰减所有问题的关注度吗？', '关注度衰减', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }

  loading.value = true;
  try {
    const res = await axios.post('/api/v2/issues/decay-all');
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg);
      await loadTopIssues();
      await loadMemberIssues();
    }
  } catch (err) {
    ElMessage.error('衰减失败');
  } finally {
    loading.value = false;
  }
};

const resetCreateForm = () => {
  createForm.title = '';
  createForm.description = '';
  createForm.icon = '⚠️';
  createForm.tags = [];
  createForm.severity = 'medium';
  createForm.attention_threshold = 5;
};

const goBack = () => {
  router.push('/family/dashboard');
};

// ========== 辅助函数 ==========
const getSeverityInfo = (severity) => {
  return severityOptions.find((s) => s.value === severity) || severityOptions[1];
};

const getAttentionBarStyle = (score, threshold) => {
  const percent = Math.min(100, (score / threshold) * 100);
  const color = percent >= 100 ? '#f56c6c' : percent >= 60 ? '#e6a23c' : '#67c23a';
  return {
    width: `${percent}%`,
    backgroundColor: color,
  };
};

// ========== 生命周期 ==========
onMounted(async () => {
  await loadMembers();
  await loadTopIssues();
  await loadMemberIssues();
  await loadRecentOccurrences();
});

watch(currentMemberId, async () => {
  await loadMemberIssues();
});
</script>

<template>
  <div class="issue-page">
    <!-- 顶部导航 -->
    <header class="issue-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <h1>📋 问题关注</h1>
      </div>
      <div class="header-right">
        <el-select
          v-model="currentMemberId"
          placeholder="选择成员"
          style="width: 140px"
        >
          <el-option
            v-for="m in members"
            :key="m.id"
            :label="m.name"
            :value="m.id"
          />
        </el-select>
        <el-button :icon="Refresh" @click="loadTopIssues">刷新</el-button>
      </div>
    </header>

    <main class="issue-main" v-loading="loading">
      <!-- Top Issues -->
      <section class="top-issues-section">
        <div class="section-header">
          <h2><el-icon><Warning /></el-icon> 本周关注点</h2>
          <div class="actions">
            <el-button size="small" @click="decayAllScores">📉 衰减</el-button>
            <el-button type="primary" size="small" :icon="Plus" @click="showCreateModal = true">
              新增问题
            </el-button>
          </div>
        </div>

        <div class="issue-list">
          <div
            v-for="issue in topIssues"
            :key="issue.id"
            class="issue-card"
            :class="{ alert: issue.is_alert }"
            @click="openDetailModal(issue)"
          >
            <div class="issue-icon">{{ issue.icon }}</div>
            <div class="issue-content">
              <div class="issue-title">
                {{ issue.title }}
                <span class="member-tag">{{ issue.member_name }}</span>
              </div>
              <div class="issue-meta">
                <el-tag
                  :color="getSeverityInfo(issue.severity).color"
                  size="small"
                  effect="dark"
                >
                  {{ getSeverityInfo(issue.severity).label }}
                </el-tag>
                <span>发生 {{ issue.occurrence_count }} 次</span>
                <span v-if="issue.streak_days > 0" class="streak">
                  🔥 连续 {{ issue.streak_days }} 天无发生
                </span>
              </div>
              <div class="attention-bar-container">
                <div class="attention-bar" :style="getAttentionBarStyle(issue.attention_score, issue.attention_threshold)"></div>
              </div>
              <div class="attention-label">
                关注度: {{ issue.attention_score }} / {{ issue.attention_threshold }}
              </div>
            </div>
            <div class="issue-action">
              <el-button
                type="danger"
                size="small"
                @click.stop="openOccurrenceModal(issue)"
              >
                +1
              </el-button>
            </div>
          </div>

          <div v-if="topIssues.length === 0" class="empty-state">
            暂无关注的问题
          </div>
        </div>
      </section>

      <!-- 最近发生记录 -->
      <section class="occurrences-section">
        <div class="section-header">
          <h2><el-icon><TrendCharts /></el-icon> 最近发生</h2>
        </div>
        <div class="occurrence-list">
          <div
            v-for="occ in recentOccurrences"
            :key="occ.id"
            class="occurrence-item"
          >
            <div class="occurrence-left">
              <span class="occurrence-icon">{{ occ.issue_icon }}</span>
              <div>
                <div class="occurrence-title">{{ occ.issue_title }}</div>
                <div class="occurrence-note">{{ occ.note || '无备注' }}</div>
              </div>
            </div>
            <div class="occurrence-right">
              <span class="occurrence-member">{{ occ.member_name }}</span>
              <span class="occurrence-time">{{ dayjs(occ.occurred_at).format('MM/DD HH:mm') }}</span>
            </div>
          </div>
          <div v-if="recentOccurrences.length === 0" class="empty-state">
            暂无发生记录
          </div>
        </div>
      </section>
    </main>

    <!-- 创建问题弹窗 -->
    <el-dialog v-model="showCreateModal" title="新增问题" width="90%" max-width="500px">
      <el-form :model="createForm" label-position="top">
        <el-form-item label="问题标题" required>
          <el-input v-model="createForm.title" placeholder="例如：作业拖延" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-selector">
            <span
              v-for="icon in iconOptions"
              :key="icon"
              class="icon-option"
              :class="{ selected: createForm.icon === icon }"
              @click="createForm.icon = icon"
            >
              {{ icon }}
            </span>
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="2"
            placeholder="详细描述问题..."
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-checkbox-group v-model="createForm.tags">
            <el-checkbox-button
              v-for="tag in tagOptions"
              :key="tag"
              :value="tag"
            >
              {{ tag }}
            </el-checkbox-button>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="严重程度">
          <el-radio-group v-model="createForm.severity">
            <el-radio-button
              v-for="s in severityOptions"
              :key="s.value"
              :value="s.value"
            >
              {{ s.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="关注阈值">
          <el-input-number
            v-model="createForm.attention_threshold"
            :min="1"
            :max="20"
          />
          <div class="form-hint">达到此值时触发警报</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateModal = false">取消</el-button>
        <el-button type="primary" @click="createIssue" :loading="loading">
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 记录发生弹窗 -->
    <el-dialog v-model="showOccurrenceModal" title="记录问题发生" width="90%" max-width="400px">
      <div class="occurrence-form">
        <h3>{{ occurrenceForm.issueTitle }}</h3>
        <el-form label-position="top">
          <el-form-item label="发生场景">
            <el-input v-model="occurrenceForm.context" placeholder="例如：放学后" />
          </el-form-item>
          <el-form-item label="备注说明">
            <el-input
              v-model="occurrenceForm.note"
              type="textarea"
              :rows="2"
              placeholder="简要描述情况..."
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showOccurrenceModal = false">取消</el-button>
        <el-button type="danger" @click="recordOccurrence" :loading="loading">
          确认记录
        </el-button>
      </template>
    </el-dialog>

    <!-- 问题详情弹窗 -->
    <el-dialog v-model="showDetailModal" title="问题详情" width="90%" max-width="600px">
      <div v-if="detailData" class="detail-content">
        <div class="detail-header">
          <span class="detail-icon">{{ detailData.issue.icon }}</span>
          <h2>{{ detailData.issue.title }}</h2>
        </div>
        <p class="detail-desc">{{ detailData.issue.description || '无描述' }}</p>
        
        <div class="detail-stats">
          <div class="stat-item">
            <span class="stat-value">{{ detailData.issue.occurrence_count }}</span>
            <span class="stat-label">发生次数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ detailData.issue.attention_score }}</span>
            <span class="stat-label">关注度</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ detailData.issue.streak_days }}</span>
            <span class="stat-label">连续无发生</span>
          </div>
        </div>

        <h4>干预措施 ({{ detailData.interventions.length }})</h4>
        <div class="intervention-list">
          <div v-for="iv in detailData.interventions" :key="iv.id" class="intervention-item">
            <span>{{ iv.icon }} {{ iv.name }}</span>
            <el-tag size="small">{{ iv.action_type }}</el-tag>
          </div>
          <div v-if="detailData.interventions.length === 0" class="empty-hint">
            暂无干预措施
          </div>
        </div>

        <h4>最近发生 ({{ detailData.occurrences.length }})</h4>
        <div class="occurrence-mini-list">
          <div v-for="occ in detailData.occurrences" :key="occ.id" class="occurrence-mini">
            <span>{{ dayjs(occ.occurred_at).format('MM/DD HH:mm') }}</span>
            <span>{{ occ.note || '-' }}</span>
          </div>
          <div v-if="detailData.occurrences.length === 0" class="empty-hint">
            暂无发生记录
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.issue-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1e3a5f 0%, #0d1b2a 100%);
  color: #e0e0e0;
  font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
}

/* Header */
.issue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Main */
.issue-main {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 18px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions {
  display: flex;
  gap: 8px;
}

/* Issue List */
.issue-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.issue-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  border-left: 4px solid transparent;
}

.issue-card:hover {
  background: rgba(255, 255, 255, 0.12);
}

.issue-card.alert {
  border-left-color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}

.issue-icon {
  font-size: 32px;
}

.issue-content {
  flex: 1;
}

.issue-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

.member-tag {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  margin-left: 8px;
}

.issue-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.streak {
  color: #67c23a;
}

.attention-bar-container {
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.attention-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.attention-label {
  font-size: 12px;
  opacity: 0.7;
}

/* Occurrences Section */
.occurrences-section {
  margin-top: 32px;
}

.occurrence-list {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

.occurrence-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.occurrence-item:last-child {
  border-bottom: none;
}

.occurrence-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.occurrence-icon {
  font-size: 24px;
}

.occurrence-title {
  font-size: 14px;
  font-weight: 500;
}

.occurrence-note {
  font-size: 12px;
  opacity: 0.7;
}

.occurrence-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 12px;
}

.occurrence-member {
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.occurrence-time {
  opacity: 0.6;
}

/* Empty State */
.empty-state {
  padding: 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

/* Icon Selector */
.icon-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-option {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  background: #f5f7fa;
}

.icon-option.selected {
  border-color: #409eff;
  background: #ecf5ff;
}

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* Detail Modal */
.detail-content h4 {
  margin: 20px 0 12px;
  font-size: 14px;
  opacity: 0.8;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-icon {
  font-size: 40px;
}

.detail-header h2 {
  margin: 0;
  font-size: 20px;
}

.detail-desc {
  color: #666;
  margin-bottom: 20px;
}

.detail-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #409eff;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.intervention-list,
.occurrence-mini-list {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
}

.intervention-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.intervention-item:last-child {
  border-bottom: none;
}

.occurrence-mini {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.empty-hint {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 12px;
}

/* Responsive */
@media (max-width: 768px) {
  .issue-header {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .issue-card {
    flex-wrap: wrap;
  }

  .issue-action {
    width: 100%;
    margin-top: 8px;
  }

  .issue-action .el-button {
    width: 100%;
  }
}
</style>
