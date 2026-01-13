<template>
  <div class="h-[calc(100vh-110px)] flex flex-col p-4">

    <el-card shadow="hover" class="mb-4 flex-shrink-0">
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold flex items-center">
          <span class="mr-2">🥦</span> {{ $t('catering.ingredients.title') }}
        </div>
        <el-button type="primary" icon="Plus" @click="openAddDialog">{{ $t('catering.ingredients.addBtn') }}</el-button>
      </div>
    </el-card>

    <div class="flex-1 overflow-hidden bg-white rounded border border-gray-200 shadow-sm">
      <el-table :data="tableData" stripe v-loading="loading" border :span-method="objectSpanMethod" height="100%"
        style="width: 100%">
        <el-table-column prop="category" :label="$t('catering.ingredients.colCategory')" width="120" align="center">
          <template #default="{ row }">
            <el-tag effect="dark" type="info" size="large">{{ row.category }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="name" :label="$t('catering.ingredients.colName')" min-width="150">
          <template #default="{ row }">
            <span class="font-bold text-gray-700">{{ row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="unit" :label="$t('catering.ingredients.colUnit')" width="120">
          <template #default="{ row }">
            <span class="text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded text-xs">
              {{ getUnitLabel(row.unit) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('catering.ingredients.colPrice')" width="120">
          <template #default="{ row }">
            <span class="font-bold text-orange-600">¥{{ row.price }}</span>
            <span class="text-xs text-gray-400">/{{ row.unit }}</span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('catering.ingredients.colSource')" width="140">
          <template #default="{ row }">
            <el-tag :type="getSourceTagType(row.source)" effect="plain">
              {{ row.source }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="$t('catering.ingredients.colAllergen')" width="160">
          <template #default="{ row }">
            <el-tag v-if="row.allergen_type !== '无'" type="danger" effect="light">
              ⚠️ {{ row.allergen_type }}
            </el-tag>
            <span v-else class="text-gray-400 text-xs flex items-center">
              <el-icon class="mr-1">
                <CircleCheck />
              </el-icon> {{ $t('catering.ingredients.safe') }}
            </span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('common.action')" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? $t('catering.ingredients.dialogEdit') : $t('catering.ingredients.dialogAdd')" width="500px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item :label="$t('catering.ingredients.labelName')" required>
          <el-input v-model="form.name" :placeholder="$t('catering.ingredients.placeholderName')" />
        </el-form-item>
        <el-form-item :label="$t('catering.ingredients.labelCategory')" required>
          <el-select v-model="form.category" :placeholder="$t('common.placeholderSelect')" style="width:100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('catering.ingredients.labelUnit')" required>
          <el-select v-model="form.unit" :placeholder="$t('common.placeholderSelect')" style="width:100%">
            <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('catering.ingredients.labelSource')" required>
          <el-select v-model="form.source" :placeholder="$t('common.placeholderSelect')" style="width:100%">
            <el-option label="🔵 盒马鲜生" value="盒马鲜生" />
            <el-option label="🔵 山姆会员店" value="山姆" />
            <el-option label="🔵 麦德龙" value="麦德龙" />
            <el-option label="🟢 叮咚买菜" value="叮咚买菜" />
            <el-option label="🟢 朴朴超市" value="朴朴" />
            <el-option label="⚪ 菜市场/其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('catering.ingredients.labelPrice')" required>
          <el-input-number v-model="form.price" :min="0" :precision="2" :step="0.5" controls-position="right"
            style="width: 100%">
            <template #prefix>¥</template>
          </el-input-number>
        </el-form-item>
        <el-form-item :label="$t('catering.ingredients.labelAllergen')">
          <el-select v-model="form.allergen_type" :placeholder="$t('common.placeholderSelect')" style="width:100%">
            <el-option label="无 (安全)" value="无" />
            <el-option label="🥜 花生/坚果" value="花生" />
            <el-option label="🦐 海鲜/虾蟹" value="海鲜" />
            <el-option label="🥛 蛋/奶制品" value="蛋奶" />
            <el-option label="🥭 芒果/菠萝" value="水果" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ isEdit ? $t('common.save') : $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, CircleCheck } from '@element-plus/icons-vue';

const { t } = useI18n();

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

const getSourceTagType = (source) => {
  if (['盒马鲜生', '山姆', '麦德龙'].includes(source)) return 'primary';
  if (['叮咚买菜', '朴朴'].includes(source)) return 'success';
  return 'info';
};

const spanArr = ref([]);
const calculateSpans = (data) => {
  spanArr.value = [];
  let pos = 0;
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      spanArr.value.push(1);
      pos = 0;
    } else {
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

const objectSpanMethod = ({ row, column, rowIndex, columnIndex }) => {
  if (columnIndex === 0) {
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
      calculateSpans(tableData.value);
    }
  } catch (err) { ElMessage.error(t('common.failed')); }
  finally { loading.value = false; }
};

const openAddDialog = () => {
  isEdit.value = false;
  Object.assign(form, { id: null, name: '', category: '蔬菜水果', unit: '斤', allergen_type: '无', price: 0, source: '盒马鲜生' });
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  if (!form.source) form.source = '其他';
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!form.name) return ElMessage.warning(t('common.placeholderInput') + t('catering.ingredients.labelName'));
  try {
    let res;
    if (isEdit.value) res = await axios.put(`/api/catering/ingredients/${form.id}`, form);
    else res = await axios.post('/api/catering/ingredients', form);
    if (res.data.code === 200) {
      ElMessage.success(t('catering.ingredients.msgSaveSuccess'));
      dialogVisible.value = false;
      fetchData();
    }
  } catch (err) { ElMessage.error(t('common.failed')); }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(t('catering.ingredients.msgDeleteConfirm').replace('{name}', row.name));
    const res = await axios.delete(`/api/catering/ingredients/${row.id}`);
    if (res.data.code === 200) { ElMessage.success(t('catering.ingredients.msgDeleteSuccess')); fetchData(); }
  } catch (err) { if (err !== 'cancel') ElMessage.error(t('common.failed')); }
};

onMounted(fetchData);
</script>