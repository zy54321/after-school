<template>
  <div class="p-4">
    <el-card shadow="hover" class="mb-4">
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold flex items-center">
          <span class="mr-2">🥦</span> 食材库管理
        </div>
        <el-button type="primary" icon="Plus" @click="openAddDialog">新增食材</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="食材名称" min-width="150" />

        <el-table-column label="参考单价" width="120">
          <template #default="{ row }">
            <span class="font-bold text-gray-700">¥{{ row.price }}</span>
            <span class="text-xs text-gray-400">/{{ row.unit }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="unit" label="采购单位" width="150">
          <template #default="{ row }">
            <span class="text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded text-xs">
              {{ getUnitLabel(row.unit) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="风险标签 (过敏源)" width="180">
          <template #default="{ row }">
            <el-tag v-if="row.allergen_type !== '无'" type="danger" effect="dark">
              ⚠️ {{ row.allergen_type }}
            </el-tag>
            <span v-else class="text-gray-400 text-xs">安全</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑食材' : '新增食材'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="食材名称" required>
          <el-input v-model="form.name" placeholder="如: 鸡蛋" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="form.category" placeholder="请选择" style="width:100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>

        <el-form-item label="参考单价" required>
          <el-input-number v-model="form.price" :min="0" :precision="2" :step="0.5" controls-position="right"
            style="width: 100%">
            <template #prefix>¥</template>
          </el-input-number>
        </el-form-item>

        <el-form-item label="采购单位" required>
          <el-select v-model="form.unit" placeholder="请选择" style="width:100%">
            <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="风险标签">
          <el-select v-model="form.allergen_type" placeholder="是否含常见过敏源?" style="width:100%">
            <el-option label="无 (安全)" value="无" />
            <el-option label="🥜 花生/坚果" value="花生" />
            <el-option label="🦐 海鲜/虾蟹" value="海鲜" />
            <el-option label="🥛 蛋/奶制品" value="蛋奶" />
            <el-option label="🥭 芒果/菠萝" value="水果" />
          </el-select>
          <div class="text-xs text-gray-400 mt-1">系统会自动比对学员过敏档案，请如实选择。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '确定新增' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

const loading = ref(false);
const tableData = ref([]);
const dialogVisible = ref(false);
const isEdit = ref(false); // 编辑状态
const categories = ['肉禽蛋', '水产', '蔬菜水果', '米面粮油', '调味品', '干货'];

// ⭐ 核心优化：定义统一的单位字典 (Value -> Label)
const unitOptions = [
  { label: '斤 (500g)', value: '斤' },
  { label: '公斤 (kg)', value: 'kg' },
  { label: '个', value: '个' },
  { label: '升 (L)', value: 'L' },
  { label: '包', value: '包' },
  { label: '瓶', value: '瓶' },
  { label: '盒', value: '盒' },
  { label: '袋', value: '袋' },
  { label: '罐', value: '罐' }
];

const form = reactive({
  id: null, name: '', category: '蔬菜水果', unit: '斤', allergen_type: '无'
});

// 辅助函数：根据 value 获取 label
const getUnitLabel = (val) => {
  const target = unitOptions.find(u => u.value === val);
  return target ? target.label : val; // 如果找不到，兜底显示原值
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/catering/ingredients');
    if (res.data.code === 200) tableData.value = res.data.data;
  } catch (err) { ElMessage.error('获取失败'); }
  finally { loading.value = false; }
};

const openAddDialog = () => {
  isEdit.value = false;
  // 重置表单
  Object.assign(form, { id: null, name: '', category: '蔬菜水果', unit: '斤', allergen_type: '无', price: 0 });
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true;
  // 回填数据
  Object.assign(form, row);
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!form.name) return ElMessage.warning('请输入名称');
  try {
    let res;
    if (isEdit.value) {
      // 编辑
      res = await axios.put(`/api/catering/ingredients/${form.id}`, form);
    } else {
      // 新增
      res = await axios.post('/api/catering/ingredients', form);
    }

    if (res.data.code === 200) {
      ElMessage.success(isEdit.value ? '更新成功' : '添加成功');
      dialogVisible.value = false;
      fetchData();
    }
  } catch (err) { ElMessage.error('操作失败'); }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.name} 吗? 如果它已被做成菜品，将无法删除。`);
    const res = await axios.delete(`/api/catering/ingredients/${row.id}`);
    if (res.data.code === 200) {
      ElMessage.success('删除成功');
      fetchData();
    }
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.response?.data?.msg || '删除失败');
  }
};

onMounted(fetchData);
</script>