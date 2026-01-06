<script setup>
import { computed } from 'vue';

const props = defineProps({
  tasks: {
    type: Array,
    required: true,
    default: () => []
  },
  categories: {
    type: Array,
    required: true,
    default: () => []
  }
});

const emit = defineEmits(['task-click', 'context-menu']);

// 过滤出扣分任务
const penaltyTasks = computed(() => {
  return props.tasks.filter(t => t.points < 0);
});

// 按分类分组
const tasksByCategory = computed(() => {
  const grouped = {};
  props.categories.forEach(cat => {
    const categoryTasks = penaltyTasks.value.filter(t => t.category === cat.key);
    if (categoryTasks.length > 0) {
      grouped[cat.key] = {
        category: cat,
        tasks: categoryTasks
      };
    }
  });
  return grouped;
});

const handleTaskClick = (task) => {
  emit('task-click', task);
};

const handleContextMenu = (e, task) => {
  emit('context-menu', e, task, 'task');
};

let longPressTimer = null;

const handleTouchStart = (e, task) => {
  longPressTimer = setTimeout(() => {
    emit('context-menu', e.touches[0], task, 'task');
  }, 600);
};

const handleTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};
</script>

<template>
  <div class="task-list">
    <div v-for="(group, catKey) in tasksByCategory" :key="catKey">
      <div class="category-title">{{ group.category.name }}</div>
      <div class="grid">
        <div
          v-for="t in group.tasks"
          :key="t.id"
          class="card task-card warning"
          @click="handleTaskClick(t)"
          @contextmenu="handleContextMenu($event, t)"
          @touchstart="handleTouchStart($event, t)"
          @touchend="handleTouchEnd">
          <div class="icon">{{ t.icon || '⚠️' }}</div>
          <div class="info">
            <div class="t-name">{{ t.title }}</div>
            <div class="t-pts text-red">{{ t.points }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  padding: 10px;
}

.category-title {
  margin: 10px 5px 5px;
  font-weight: bold;
  color: #909399;
  font-size: 0.85rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
  gap: 10px;
  padding: 5px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  position: relative;
}

.card:active {
  transform: scale(0.96);
  background: #f5f5f5;
}

.task-card .icon {
  font-size: 24px;
  margin-right: 12px;
}

.card.warning {
  border-left: 3px solid #F56C6C;
}

.t-name {
  font-weight: bold;
  font-size: 0.9rem;
  color: #333;
}

.text-red {
  color: #F56C6C;
  font-weight: bold;
}
</style>

