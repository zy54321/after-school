<template>
  <div class="h-[calc(100vh-110px)] flex flex-col p-4">

    <el-card shadow="hover" class="mb-4 flex-shrink-0">
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold flex items-center">
          <span class="mr-2">🥦</span> 食材库管理
        </div>
        <el-button type="primary" icon="Plus" @click="openAddDialog">新增食材</el-button>
      </div>
    </el-card>

    <div class="flex-1 overflow-hidden bg-white rounded border border-gray-200 shadow-sm">
      <el-table :data="tableData" stripe v-loading="loading" border :span-method="objectSpanMethod" height="100%"
        style="width: 100%">
        <el-table-column prop="category" label="分类" width="120" align="center">
          <template #default="{ row }">
            <el-tag effect="dark" type="info" size="large">{{ row.category }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="食材名称" min-width="150">
          <template #default="{ row }">
            <span class="font-bold text-gray-700">{{ row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="unit" label="采购单位" width="120">
          <template #default="{ row }">
            <span class="text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded text-xs">
              {{ getUnitLabel(row.unit) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="参考单价" width="120">
          <template #default="{ row }">
            <span class="font-bold text-orange-600">¥{{ row.price }}</span>
            <span class="text-xs text-gray-400">/{{ row.unit }}</span>
          </template>
        </el-table-column>

        <el-table-column label="货源渠道" width="140">
          <template #default="{ row }">
            <el-tag :type="getSourceTagType(row.source)" effect="plain">
              {{ row.source }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="风险标签 (过敏源)" width="160">
          <template #default="{ row }">
            <el-tag v-if="row.allergen_type !== '无'" type="danger" effect="light">
              ⚠️ {{ row.allergen_type }}
            </el-tag>
            <span v-else class="text-gray-400 text-xs flex items-center">
              <el-icon class="mr-1">
                <CircleCheck />
              </el-icon> 安全
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑食材' : '新增食材'" width="500px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="食材名称" required>
          <el-input v-model="form.name" placeholder="如: 鸡蛋" />
        </el-form-item>

        <el-form-item label="分类" required>
          <el-select v-model="form.category" placeholder="请选择" style="width:100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>

        <el-form-item label="采购单位" required>
          <el-select v-model="form.unit" placeholder="请选择" style="width:100%">
            <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="推荐货源" required>
          <el-select v-model="form.source" placeholder="选择采购渠道" style="width:100%">
            <el-option label="🔵 盒马鲜生" value="盒马鲜生" />
            <el-option label="🔵 山姆会员店" value="山姆" />
            <el-option label="🔵 麦德龙" value="麦德龙" />
            <el-option label="🟢 叮咚买菜" value="叮咚买菜" />
            <el-option label="🟢 朴朴超市" value="朴朴" />
            <el-option label="⚪ 菜市场/其他" value="其他" />
          </el-select>
        </el-form-item>

        <el-form-item label="参考单价" required>
          <el-input-number v-model="form.price" :min="0" :precision="2" :step="0.5" controls-position="right"
            style="width: 100%">
            <template #prefix>¥</template>
          </el-input-number>
        </el-form-item>

        <el-form-item label="风险标签">
          <el-select v-model="form.allergen_type" placeholder="是否含常见过敏源?" style="width:100%">
            <el-option label="无 (安全)" value="无" />
            <el-option label="🥜 花生/坚果" value="花生" />
            <el-option label="🦐 海鲜/虾蟹" value="海鲜" />
            <el-option label="🥛 蛋/奶制品" value="蛋奶" />
            <el-option label="🥭 芒果/菠萝" value="水果" />
          </el-select>
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
import { Plus, CircleCheck } from '@element-plus/icons-vue';

const loading = ref(false);
const tableData = ref([]);
const dialogVisible = ref(false);
const isEdit = ref(false);
const categories = ['肉禽蛋', '水产', '蔬菜水果', '米面粮油', '调味品', '干货', '其他'];

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
  id: null, name: '', category: '蔬菜水果', unit: '斤', allergen_type: '无', price: 0, source: '盒马鲜生'
});

const getUnitLabel = (val) => {
  const target = unitOptions.find(u => u.value === val);
  return target ? target.label : val;
};

// 货源颜色映射
const getSourceTagType = (source) => {
  if (['盒马鲜生', '山姆', '麦德龙'].includes(source)) return 'primary'; // 蓝
  if (['叮咚买菜', '朴朴'].includes(source)) return 'success'; // 绿
  return 'info'; // 灰
};

// ⭐ 核心逻辑：自动计算合并行
// 目的：让相同 category 的行，在第一列合并显示
const spanArr = ref([]);
const calculateSpans = (data) => {
  spanArr.value = [];
  let pos = 0;
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      spanArr.value.push(1);
      pos = 0;
    } else {
      // 如果当前行和上一行的分类相同，则合并
      if (data[i].category === data[i - 1].category) {
        spanArr.value[pos] += 1;
        spanArr.value.push(0);
      } else {
        spanArr.value.push(1);
        pos = i;
      }
    }
  }
};

// Element Plus 表格合并回调
const objectSpanMethod = ({ row, column, rowIndex, columnIndex }) => {
  if (columnIndex === 0) { // 只合并第 0 列 (分类列)
    const _row = spanArr.value[rowIndex];
    const _col = _row > 0 ? 1 : 0;
    return { rowspan: _row, colspan: _col };
  }
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/catering/ingredients');
    if (res.data.code === 200) {
      tableData.value = res.data.data;
      // 数据回来后，计算合并规则
      calculateSpans(tableData.value);
    }
  } catch (err) { ElMessage.error('获取失败'); }
  finally { loading.value = false; }
};

const openAddDialog = () => {
  isEdit.value = false;
  // 重置表单，默认货源为盒马
  Object.assign(form, {
    id: null, name: '', category: '蔬菜水果', unit: '斤', allergen_type: '无', price: 0, source: '盒马鲜生'
  });
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  // 防止旧数据 source 为空
  if (!form.source) form.source = '其他';
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!form.name) return ElMessage.warning('请输入名称');
  try {
    let res;
    if (isEdit.value) {
      res = await axios.put(`/api/catering/ingredients/${form.id}`, form);
    } else {
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
    await ElMessageBox.confirm(`确定删除 ${row.name} 吗?`);
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