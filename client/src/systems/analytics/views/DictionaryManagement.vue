<template>
  <div class="dictionary-management">
    <header class="page-header">
      <div class="header-left">
        <el-button circle plain :icon="Back" class="back-btn" @click="$router.push('/strategy/map')" />
        <h1 class="page-title">{{ $t('dictionary.title') }}</h1>
      </div>
      <div class="header-right">
        <el-button link class="lang-btn" @click="toggleLang" style="color: #409EFF; margin-right: 15px;">
          {{ locale === 'zh' ? '中文' : 'English' }}
        </el-button>
      </div>
    </header>

    <div class="main-container">
      <!-- 左侧：几何类型切换 -->
      <aside class="geometry-tabs">
        <el-tabs v-model="activeGeometryType" tab-position="left" @tab-change="handleGeometryTypeChange">
          <el-tab-pane :label="$t('dictionary.geometryTypes.point')" name="Point">
            <template #label>
              <span class="tab-label">
                <span class="tab-icon">📍</span>
                {{ $t('dictionary.geometryTypes.point') }}
              </span>
            </template>
          </el-tab-pane>
          <el-tab-pane :label="$t('dictionary.geometryTypes.line')" name="LineString">
            <template #label>
              <span class="tab-label">
                <span class="tab-icon">〰️</span>
                {{ $t('dictionary.geometryTypes.line') }}
              </span>
            </template>
          </el-tab-pane>
          <el-tab-pane :label="$t('dictionary.geometryTypes.polygon')" name="Polygon">
            <template #label>
              <span class="tab-label">
                <span class="tab-icon">⬡</span>
                {{ $t('dictionary.geometryTypes.polygon') }}
              </span>
            </template>
          </el-tab-pane>
        </el-tabs>
      </aside>

      <!-- 中间：类型列表 -->
      <main class="types-section">
        <div class="section-header">
          <h2>{{ $t('dictionary.types.title') }}</h2>
          <el-button type="primary" :icon="Plus" @click="handleAddType">
            {{ $t('dictionary.types.add') }}
          </el-button>
        </div>

        <el-table 
          :data="typesList" 
          v-loading="typesLoading" 
          stripe 
          style="width: 100%; --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent;"
          @row-click="handleTypeRowClick"
          highlight-current-row
          class="dark-table"
        >
          <el-table-column prop="name_zh" :label="$t('dictionary.types.columns.nameZh')" width="150" />
          <el-table-column prop="name_en" :label="$t('dictionary.types.columns.nameEn')" width="150" />
          <el-table-column prop="type_code" :label="$t('dictionary.types.columns.code')" width="120" />
          <el-table-column :label="$t('dictionary.types.columns.color')" width="100">
            <template #default="{ row }">
              <div class="color-cell">
                <span class="color-dot" :style="{ backgroundColor: row.color }"></span>
                <span>{{ row.color }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="icon" :label="$t('dictionary.types.columns.icon')" width="100" />
          <el-table-column :label="$t('dictionary.types.columns.status')" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
                {{ row.is_active ? $t('dictionary.types.status.active') : $t('dictionary.types.status.inactive') }}
              </el-tag>
            </template>
          </el-table-column>
          <!-- 🟢 调整：操作栏宽度减少20% (200 * 0.8 = 160) -->
          <el-table-column :label="$t('dictionary.types.columns.actions')" width="160" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click.stop="handleEditType(row)">{{ $t('common.edit') }}</el-button>
              <el-button size="small" type="danger" @click.stop="handleDeleteType(row)">
                {{ $t('common.delete') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </main>

      <!-- 右侧：字段管理 -->
      <aside class="fields-section" v-if="selectedType">
        <div class="section-header">
          <h3>{{ $t('dictionary.fields.title') }} - {{ selectedType.name_zh }}</h3>
          <el-button type="primary" size="small" :icon="Plus" @click="handleAddField">
            {{ $t('dictionary.fields.add') }}
          </el-button>
        </div>

        <el-table 
          :data="fieldsList" 
          v-loading="fieldsLoading" 
          stripe 
          size="small" 
          style="width: 100%; --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent;"
          class="dark-table"
          row-key="id"
          ref="fieldsTableRef"
        >
          <!-- 🟢 拖拽手柄列 -->
          <el-table-column width="40" align="center">
            <template #default>
              <span class="drag-handle">⋮⋮</span>
            </template>
          </el-table-column>
          <el-table-column prop="name_zh" :label="$t('dictionary.fields.columns.nameZh')" width="120" />
          <el-table-column prop="name_en" :label="$t('dictionary.fields.columns.nameEn')" width="120" />
          <el-table-column prop="field_key" :label="$t('dictionary.fields.columns.key')" width="120" />
          <el-table-column prop="field_type" :label="$t('dictionary.fields.columns.type')" width="100" />
          <el-table-column :label="$t('dictionary.fields.columns.required')" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_required ? 'danger' : 'info'" size="small">
                {{ row.is_required ? $t('common.yes') : $t('common.no') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('dictionary.fields.columns.actions')" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="handleEditField(row)">{{ $t('common.edit') }}</el-button>
              <el-button size="small" type="danger" @click="handleDeleteField(row)">
                {{ $t('common.delete') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </aside>
    </div>

    <!-- 类型编辑对话框 -->
    <el-dialog
      v-model="typeDialogVisible"
      :title="typeDialogTitle"
      width="500px"
      @close="resetTypeForm"
    >
      <el-form :model="typeForm" :rules="typeFormRules" ref="typeFormRef" label-width="120px">
        <el-form-item :label="$t('dictionary.types.form.geometryType')" prop="geometry_type">
          <el-input v-model="typeForm.geometry_type" disabled />
        </el-form-item>
        <el-form-item :label="$t('dictionary.types.form.code')" prop="type_code">
          <el-input v-model="typeForm.type_code" :disabled="!!typeForm.id" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.types.form.nameZh')" prop="name_zh">
          <el-input v-model="typeForm.name_zh" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.types.form.nameEn')" prop="name_en">
          <el-input v-model="typeForm.name_en" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.types.form.color')" prop="color">
          <el-color-picker v-model="typeForm.color" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.types.form.icon')" prop="icon">
          <el-input v-model="typeForm.icon" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.types.form.sortOrder')" prop="sort_order">
          <el-input-number v-model="typeForm.sort_order" :min="0" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.types.form.status')" prop="is_active">
          <el-switch v-model="typeForm.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveType" :loading="typeSaving">
          {{ $t('common.save') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 字段编辑对话框 -->
    <el-dialog
      v-model="fieldDialogVisible"
      :title="fieldDialogTitle"
      width="600px"
      @close="resetFieldForm"
      class="field-dialog"
    >
      <div class="field-form-container">
        <el-form :model="fieldForm" :rules="fieldFormRules" ref="fieldFormRef" label-width="120px">
        <el-form-item :label="$t('dictionary.fields.form.key')" prop="field_key">
          <el-input v-model="fieldForm.field_key" :disabled="!!fieldForm.id" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.nameZh')" prop="name_zh">
          <el-input v-model="fieldForm.name_zh" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.nameEn')" prop="name_en">
          <el-input v-model="fieldForm.name_en" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.type')" prop="field_type">
          <el-select v-model="fieldForm.field_type" style="width: 100%" @change="handleFieldTypeChange">
            <el-option label="文本" value="text" />
            <el-option label="数字" value="number" />
            <el-option label="日期" value="date" />
            <el-option label="布尔值" value="boolean" />
            <el-option label="下拉选择" value="select" />
            <el-option label="评分" value="rate" />
            <el-option label="多行文本" value="textarea" />
            <el-option label="URL" value="url" />
          </el-select>
        </el-form-item>
        
        <!-- 🟢 下拉选择类型的选项配置 -->
        <el-form-item 
          v-if="fieldForm.field_type === 'select'" 
          :label="$t('dictionary.fields.form.options')"
        >
          <div class="options-editor">
            <div 
              v-for="(option, index) in selectOptions" 
              :key="index" 
              class="option-item"
            >
              <el-input 
                v-model="option.label_zh" 
                :placeholder="$t('dictionary.fields.form.optionLabelZh')"
                style="flex: 1; margin-right: 8px;"
                size="small"
              />
              <el-input 
                v-model="option.label_en" 
                :placeholder="$t('dictionary.fields.form.optionLabelEn')"
                style="flex: 1; margin-right: 8px;"
                size="small"
              />
              <el-input 
                v-model="option.value" 
                :placeholder="$t('dictionary.fields.form.optionValue')"
                style="width: 120px; margin-right: 8px;"
                size="small"
              />
              <el-button 
                type="danger" 
                size="small" 
                :icon="Delete"
                circle
                @click="removeOption(index)"
              />
            </div>
            <el-button 
              type="primary" 
              size="small" 
              :icon="Plus"
              @click="addOption"
              style="width: 100%; margin-top: 10px;"
            >
              {{ $t('dictionary.fields.form.addOption') }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item :label="$t('dictionary.fields.form.required')" prop="is_required">
          <el-switch v-model="fieldForm.is_required" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.defaultValue')" prop="default_value">
          <el-input v-model="fieldForm.default_value" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.placeholderZh')" prop="placeholder_zh">
          <el-input v-model="fieldForm.placeholder_zh" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.placeholderEn')" prop="placeholder_en">
          <el-input v-model="fieldForm.placeholder_en" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.suffix')" prop="suffix">
          <el-input v-model="fieldForm.suffix" />
        </el-form-item>
        <el-form-item :label="$t('dictionary.fields.form.sortOrder')" prop="sort_order">
          <el-input-number v-model="fieldForm.sort_order" :min="0" />
        </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="fieldDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveField" :loading="fieldSaving">
          {{ $t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Back, Plus, Delete } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';
import Sortable from 'sortablejs';
import { usePermission } from '@/composables/usePermission';
import { PERMISSIONS } from '@/constants/permissions';

const router = useRouter();
const { hasPermission } = usePermission();

// 检查是否有管理权限
const canManage = computed(() => hasPermission(PERMISSIONS.MAP.MANAGE));
const { locale, t } = useI18n();

// 状态
const activeGeometryType = ref('Point');
const typesList = ref([]);
const fieldsList = ref([]);
const selectedType = ref(null);
const typesLoading = ref(false);
const fieldsLoading = ref(false);
const fieldsTableRef = ref(null);
let sortableInstance = null;

// 类型对话框
const typeDialogVisible = ref(false);
const typeDialogTitle = ref('');
const typeFormRef = ref(null);
const typeSaving = ref(false);
const typeForm = reactive({
  id: null,
  geometry_type: 'Point',
  type_code: '',
  name_zh: '',
  name_en: '',
  color: '#409EFF',
  icon: '',
  sort_order: 0,
  is_active: true
});

const typeFormRules = {
  type_code: [{ required: true, message: '类型代码必填', trigger: 'blur' }],
  name_zh: [{ required: true, message: '中文名称必填', trigger: 'blur' }],
  name_en: [{ required: true, message: '英文名称必填', trigger: 'blur' }]
};

// 字段对话框
const fieldDialogVisible = ref(false);
const fieldDialogTitle = ref('');
const fieldFormRef = ref(null);
const fieldSaving = ref(false);
const fieldForm = reactive({
  id: null,
  type_id: null,
  field_key: '',
  name_zh: '',
  name_en: '',
  field_type: 'text',
  is_required: false,
  default_value: '',
  placeholder_zh: '',
  placeholder_en: '',
  suffix: '',
  validation_rule: null,
  options: null,
  sort_order: 0
});

const fieldFormRules = {
  field_key: [{ required: true, message: '字段键必填', trigger: 'blur' }],
  name_zh: [{ required: true, message: '中文标签必填', trigger: 'blur' }],
  name_en: [{ required: true, message: '英文标签必填', trigger: 'blur' }],
  field_type: [{ required: true, message: '字段类型必填', trigger: 'change' }]
};

// 🟢 下拉选择选项的编辑列表
const selectOptions = ref([]);

// 🟢 处理字段类型变化
const handleFieldTypeChange = () => {
  // 如果切换到非 select 类型，清空选项
  if (fieldForm.field_type !== 'select') {
    selectOptions.value = [];
    fieldForm.options = null;
  } else {
    // 如果切换到 select 类型，初始化选项
    if (!fieldForm.options || !Array.isArray(fieldForm.options) || fieldForm.options.length === 0) {
      selectOptions.value = [];
    } else {
      selectOptions.value = [...fieldForm.options];
    }
  }
};

// 🟢 添加选项
const addOption = () => {
  selectOptions.value.push({
    label_zh: '',
    label_en: '',
    value: ''
  });
};

// 🟢 删除选项
const removeOption = (index) => {
  selectOptions.value.splice(index, 1);
};

// 方法
const toggleLang = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem('lang', locale.value);
};

const fetchTypes = async () => {
  typesLoading.value = true;
  try {
    const res = await axios.get(`/api/mapbox/dictionary/types?geometry_type=${activeGeometryType.value}`);
    if (res.data.code === 200) {
      typesList.value = res.data.data;
      // 如果之前选中的类型还在列表中，保持选中；否则选择第一个
      if (selectedType.value) {
        const found = typesList.value.find(t => t.id === selectedType.value.id);
        if (found) {
          selectedType.value = found;
          fetchFields(selectedType.value.id);
          return;
        }
      }
      if (typesList.value.length > 0) {
        selectedType.value = typesList.value[0];
        fetchFields(selectedType.value.id);
      } else {
        selectedType.value = null;
        fieldsList.value = [];
      }
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('获取类型列表失败');
  } finally {
    typesLoading.value = false;
  }
};

// 🟢 处理类型行点击
const handleTypeRowClick = (row) => {
  selectedType.value = row;
  fetchFields(row.id);
};

const fetchFields = async (typeId) => {
  if (!typeId) return;
  fieldsLoading.value = true;
  try {
    const res = await axios.get(`/api/mapbox/dictionary/fields?type_id=${typeId}`);
    if (res.data.code === 200) {
      fieldsList.value = res.data.data;
      // 🟢 初始化拖拽排序
      await nextTick();
      initSortable();
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('获取字段列表失败');
  } finally {
    fieldsLoading.value = false;
  }
};

// 🟢 初始化拖拽排序
const initSortable = () => {
  // 销毁旧的实例
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  
  // 获取表格的 tbody 元素
  const tbody = fieldsTableRef.value?.$el?.querySelector('.el-table__body-wrapper tbody');
  if (!tbody) return;
  
  sortableInstance = Sortable.create(tbody, {
    handle: '.drag-handle', // 指定拖拽手柄
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onEnd: async (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex === newIndex) return;
      
      // 更新列表顺序
      const movedItem = fieldsList.value.splice(oldIndex, 1)[0];
      fieldsList.value.splice(newIndex, 0, movedItem);
      
      // 更新 sort_order
      await updateFieldsOrder();
    }
  });
};

// 🟢 更新字段排序
const updateFieldsOrder = async () => {
  try {
    // 批量更新所有字段的 sort_order
    const updates = fieldsList.value.map((field, index) => ({
      id: field.id,
      sort_order: index
    }));
    
    // 批量更新所有字段的 sort_order
    const promises = updates.map(update => 
      axios.put(`/api/mapbox/dictionary/fields/${update.id}`, { sort_order: update.sort_order })
    );
    
    await Promise.all(promises);
    
    // 更新本地数据的 sort_order，确保显示正确
    fieldsList.value.forEach((field, index) => {
      field.sort_order = index;
    });
    
    ElMessage.success('排序已更新');
    
    // 触发字典配置更新事件
    window.dispatchEvent(new CustomEvent('dictionary-config-updated'));
  } catch (err) {
    console.error('更新字段排序失败:', err);
    ElMessage.error('更新排序失败');
    // 重新获取字段列表以恢复原始顺序
    if (selectedType.value) {
      await fetchFields(selectedType.value.id);
    }
  }
};

const handleGeometryTypeChange = () => {
  selectedType.value = null;
  fieldsList.value = [];
  fetchTypes();
};

const handleAddType = () => {
  typeDialogTitle.value = t('dictionary.types.add');
  Object.assign(typeForm, {
    id: null,
    geometry_type: activeGeometryType.value,
    type_code: '',
    name_zh: '',
    name_en: '',
    color: '#409EFF',
    icon: '',
    sort_order: 0,
    is_active: true
  });
  typeDialogVisible.value = true;
};

const handleEditType = (row) => {
  typeDialogTitle.value = t('dictionary.types.edit');
  Object.assign(typeForm, { ...row });
  typeDialogVisible.value = true;
};

const handleDeleteType = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除类型 "${row.name_zh}" 吗？`,
      '警告',
      { type: 'warning' }
    );
    
    const res = await axios.delete(`/api/mapbox/dictionary/types/${row.id}`);
    if (res.data.code === 200) {
      ElMessage.success('删除成功');
      await fetchTypes();
      if (selectedType.value?.id === row.id) {
        selectedType.value = null;
        fieldsList.value = [];
      }
      // 🟢 触发字典配置更新事件，通知地图页面刷新
      window.dispatchEvent(new CustomEvent('dictionary-config-updated'));
    } else {
      ElMessage.error(res.data.msg || '删除失败');
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err);
      ElMessage.error(err.response?.data?.msg || '删除失败');
    }
  }
};

const saveType = async () => {
  if (!typeFormRef.value) return;
  await typeFormRef.value.validate(async (valid) => {
    if (valid) {
      typeSaving.value = true;
      try {
        let res;
        if (typeForm.id) {
          res = await axios.put(`/api/mapbox/dictionary/types/${typeForm.id}`, typeForm);
        } else {
          res = await axios.post('/api/mapbox/dictionary/types', typeForm);
        }
        
        if (res.data.code === 200) {
          ElMessage.success('保存成功');
          typeDialogVisible.value = false;
          await fetchTypes();
          // 🟢 触发字典配置更新事件，通知地图页面刷新
          window.dispatchEvent(new CustomEvent('dictionary-config-updated'));
        } else {
          ElMessage.error(res.data.msg || '保存失败');
        }
      } catch (err) {
        console.error(err);
        ElMessage.error(err.response?.data?.msg || '保存失败');
      } finally {
        typeSaving.value = false;
      }
    }
  });
};

const resetTypeForm = () => {
  typeFormRef.value?.resetFields();
};

const handleAddField = () => {
  if (!selectedType.value) {
    ElMessage.warning('请先选择一个类型');
    return;
  }
  fieldDialogTitle.value = t('dictionary.fields.add');
  Object.assign(fieldForm, {
    id: null,
    type_id: selectedType.value.id,
    field_key: '',
    name_zh: '',
    name_en: '',
    field_type: 'text',
    is_required: false,
    default_value: '',
    placeholder_zh: '',
    placeholder_en: '',
    suffix: '',
    validation_rule: null,
    options: null,
    sort_order: 0
  });
  selectOptions.value = []; // 🟢 重置选项列表
  fieldDialogVisible.value = true;
};

const handleEditField = (row) => {
  fieldDialogTitle.value = t('dictionary.fields.edit');
  Object.assign(fieldForm, { ...row });
  
  // 🟢 如果是 select 类型，加载选项
  if (row.field_type === 'select' && row.options) {
    // 处理 options 可能是字符串的情况
    let optionsData = row.options;
    if (typeof optionsData === 'string') {
      try {
        optionsData = JSON.parse(optionsData);
      } catch (e) {
        console.error('解析 options 失败:', e);
        optionsData = [];
      }
    }
    
    if (Array.isArray(optionsData) && optionsData.length > 0) {
      selectOptions.value = [...optionsData];
    } else {
      selectOptions.value = [];
    }
  } else {
    selectOptions.value = [];
  }
  
  fieldDialogVisible.value = true;
};

const handleDeleteField = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除字段 "${row.name_zh}" 吗？`,
      '警告',
      { type: 'warning' }
    );
    
    const res = await axios.delete(`/api/mapbox/dictionary/fields/${row.id}`);
    if (res.data.code === 200) {
      ElMessage.success('删除成功');
      await fetchFields(selectedType.value.id);
      // 🟢 触发字典配置更新事件，通知地图页面刷新
      window.dispatchEvent(new CustomEvent('dictionary-config-updated'));
    } else {
      ElMessage.error(res.data.msg || '删除失败');
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err);
      ElMessage.error(err.response?.data?.msg || '删除失败');
    }
  }
};

const saveField = async () => {
  if (!fieldFormRef.value) return;
  
  // 🟢 如果是 select 类型，验证并保存选项
  if (fieldForm.field_type === 'select') {
    // 验证选项是否完整
    const invalidOptions = selectOptions.value.filter(opt => 
      !opt.label_zh || !opt.label_en || !opt.value
    );
    
    if (invalidOptions.length > 0) {
      ElMessage.warning('请完整填写所有选项的中文标签、英文标签和值');
      return;
    }
    
    // 检查是否有重复的值
    const values = selectOptions.value.map(opt => opt.value);
    const uniqueValues = new Set(values);
    if (values.length !== uniqueValues.size) {
      ElMessage.warning('选项的值不能重复');
      return;
    }
    
    // 保存选项到 fieldForm
    fieldForm.options = selectOptions.value.length > 0 ? selectOptions.value : null;
  } else {
    // 非 select 类型，清空选项
    fieldForm.options = null;
  }
  
  await fieldFormRef.value.validate(async (valid) => {
    if (valid) {
      fieldSaving.value = true;
      try {
        let res;
        if (fieldForm.id) {
          res = await axios.put(`/api/mapbox/dictionary/fields/${fieldForm.id}`, fieldForm);
        } else {
          res = await axios.post('/api/mapbox/dictionary/fields', fieldForm);
        }
        
        if (res.data.code === 200) {
          ElMessage.success('保存成功');
          fieldDialogVisible.value = false;
          await fetchFields(selectedType.value.id);
          // 🟢 fetchFields 内部会重新初始化拖拽排序
          // 🟢 触发字典配置更新事件，通知地图页面刷新
          window.dispatchEvent(new CustomEvent('dictionary-config-updated'));
        } else {
          ElMessage.error(res.data.msg || '保存失败');
        }
      } catch (err) {
        console.error(err);
        ElMessage.error(err.response?.data?.msg || '保存失败');
      } finally {
        fieldSaving.value = false;
      }
    }
  });
};

const resetFieldForm = () => {
  fieldFormRef.value?.resetFields();
  selectOptions.value = []; // 🟢 重置选项列表
};

// 监听类型选择
watch(() => typesList.value, (newVal) => {
  if (newVal.length > 0 && !selectedType.value) {
    selectedType.value = newVal[0];
    fetchFields(selectedType.value.id);
  }
});

// 生命周期
onMounted(() => {
  fetchTypes();
});

// 🟢 组件卸载时清理拖拽实例
onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
});
</script>

<style scoped>
.dictionary-management {
  min-height: 100vh;
  background: #0f172a;
  color: #fff;
  padding: 20px 20px 20px 20px; /* 保持左右内边距 */
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.main-container {
  display: grid;
  /* 🟢 调整：类型管理和字段管理窗口等宽，平分剩余空间 */
  grid-template-columns: 150px 1fr 1fr;
  gap: 20px;
  height: calc(100vh - 120px);
  width: 100%;
  max-width: 100%;
}

.geometry-tabs {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-icon {
  font-size: 18px;
}

.types-section,
.fields-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2,
.section-header h3 {
  margin: 0;
  font-size: 18px;
}

.color-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 20px !important;
  height: 20px !important;
  min-width: 20px !important;
  min-height: 20px !important;
  max-width: 20px !important;
  max-height: 20px !important;
  flex-shrink: 0 !important;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: inline-block;
  box-sizing: border-box;
}

/* 表格深色主题样式 - 强制覆盖所有背景 */
.dark-table,
:deep(.dark-table),
:deep(.el-table) {
  background: transparent !important;
  background-color: transparent !important;
  color: #fff !important;
  --el-table-bg-color: transparent !important;
  --el-table-tr-bg-color: transparent !important;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.1) !important;
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.05) !important;
  --el-table-striped-bg-color: rgba(255, 255, 255, 0.02) !important;
}

:deep(.el-table__header-wrapper) {
  background: rgba(255, 255, 255, 0.1) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.el-table__body-wrapper),
.dark-table .el-table__body-wrapper {
  background: transparent !important;
  background-color: transparent !important;
}

/* 强制覆盖表格主体的所有可能背景 */
:deep(.el-table__body-wrapper .el-table__body),
.dark-table .el-table__body-wrapper .el-table__body {
  background: transparent !important;
  background-color: transparent !important;
}

/* 使用全局样式强制覆盖（如果 scoped 样式不够） */
.dictionary-management :deep(.el-table__body-wrapper) {
  background: transparent !important;
  background-color: transparent !important;
}

.dictionary-management :deep(.el-table__body) {
  background: transparent !important;
  background-color: transparent !important;
}

.dictionary-management :deep(.el-table__body tbody) {
  background: transparent !important;
  background-color: transparent !important;
}

.dictionary-management :deep(.el-table__body tbody tr) {
  background: transparent !important;
  background-color: transparent !important;
}

.dictionary-management :deep(.el-table__body tbody tr td) {
  background: transparent !important;
  background-color: transparent !important;
}

:deep(.el-table__header) {
  background: rgba(255, 255, 255, 0.1) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.el-table__body) {
  background: transparent !important;
  background-color: transparent !important;
}

:deep(.el-table th) {
  background: rgba(255, 255, 255, 0.1) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:deep(.el-table th .cell) {
  color: #fff !important;
}

:deep(.el-table td) {
  background: transparent !important;
  background-color: transparent !important;
  color: #fff !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
}

/* 🟢 操作栏背景颜色 - 使用更协调的深色 */
.dictionary-management :deep(.el-table th:last-child),
.dictionary-management :deep(.el-table td:last-child),
.dictionary-management :deep(.el-table__header th:last-child),
.dictionary-management :deep(.el-table__body td:last-child),
:deep(.el-table th:last-child),
:deep(.el-table td:last-child),
:deep(.el-table__header th:last-child),
:deep(.el-table__body td:last-child) {
  background: rgba(30, 41, 59, 1) !important; /* 更深的蓝灰色，与整体风格协调 */
  background-color: rgba(30, 41, 59, 1) !important;
}

/* 🟢 操作栏悬停时也保持协调的颜色 */
.dictionary-management :deep(.el-table__body tr:hover td:last-child),
:deep(.el-table__body tr:hover td:last-child) {
  background: rgba(51, 65, 85, 1) !important; /* 悬停时稍微亮一点 */
  background-color: rgba(51, 65, 85, 1) !important;
}

/* 🟢 操作栏条纹行也保持协调的颜色 */
.dictionary-management :deep(.el-table--striped .el-table__body tr.el-table__row--striped td:last-child),
:deep(.el-table--striped .el-table__body tr.el-table__row--striped td:last-child) {
  background: rgba(30, 41, 59, 1) !important;
  background-color: rgba(30, 41, 59, 1) !important;
}

:deep(.el-table td .cell) {
  color: #fff !important;
}

:deep(.el-table tr) {
  background: transparent !important;
  background-color: transparent !important;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped) {
  background: rgba(255, 255, 255, 0.02) !important;
  background-color: rgba(255, 255, 255, 0.02) !important;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(255, 255, 255, 0.02) !important;
  background-color: rgba(255, 255, 255, 0.02) !important;
}

:deep(.el-table__body tr:hover > td) {
  background: rgba(255, 255, 255, 0.05) !important;
  background-color: rgba(255, 255, 255, 0.05) !important;
}

:deep(.el-table__empty-block) {
  background: transparent !important;
  background-color: transparent !important;
}

:deep(.el-table__empty-text) {
  color: rgba(255, 255, 255, 0.5) !important;
}

/* 表格边框 */
:deep(.el-table::before) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.el-table__border-left-patch) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* 对话框深色主题样式 */
:deep(.el-dialog) {
  background: #1e293b !important;
  color: #fff;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.el-dialog__title) {
  color: #fff !important;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: #fff !important;
}

:deep(.el-dialog__body) {
  color: #fff;
}

/* 🟢 字段编辑对话框样式 - 对话框不滚动，表单内容可滚动 */
.field-dialog :deep(.el-dialog__body) {
  overflow: hidden !important;
  padding: 20px !important;
  max-height: calc(80vh - 120px) !important;
  display: flex;
  flex-direction: column;
}

.field-form-container {
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(80vh - 180px);
  padding-right: 10px;
  flex: 1;
}

/* 自定义滚动条样式 */
.field-form-container::-webkit-scrollbar {
  width: 6px;
}

.field-form-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.field-form-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.field-form-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 🟢 下拉选项编辑器样式 */
.options-editor {
  width: 100%;
}

.option-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  gap: 8px;
}

.option-item:last-child {
  margin-bottom: 0;
}

/* 🟢 拖拽排序样式 */
.drag-handle {
  cursor: move;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  user-select: none;
  display: inline-block;
  line-height: 1;
  letter-spacing: -2px;
}

.drag-handle:hover {
  color: rgba(255, 255, 255, 0.8);
}

/* Sortable.js 拖拽样式 */
.sortable-ghost {
  opacity: 0.5;
  background: rgba(64, 158, 255, 0.2) !important;
}

.sortable-chosen {
  background: rgba(64, 158, 255, 0.1) !important;
}

.sortable-drag {
  opacity: 0.8;
}

/* 表单深色主题样式 - 强制覆盖输入框背景 */
:deep(.el-form-item__label) {
  color: #cbd5e1 !important;
}

/* 输入框样式 - 使用更具体的选择器覆盖所有可能的类名 */
.dictionary-management :deep(.el-input),
.dictionary-management :deep(.el-input__inner),
.dictionary-management :deep(.el-input__wrapper),
.dictionary-management :deep(.el-input__wrapper input),
.dictionary-management :deep(.el-input input),
:deep(.el-input),
:deep(.el-input__inner),
:deep(.el-input__wrapper),
:deep(.el-input__wrapper input),
:deep(.el-input input) {
  background: rgba(255, 255, 255, 0.1) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.dictionary-management :deep(.el-input__inner),
.dictionary-management :deep(.el-input__wrapper),
.dictionary-management :deep(.el-input__wrapper input),
.dictionary-management :deep(.el-input input),
:deep(.el-input__inner),
:deep(.el-input__wrapper),
:deep(.el-input__wrapper input),
:deep(.el-input input) {
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: #fff !important;
}

/* 确保输入框内的文本是白色的 */
.dictionary-management :deep(.el-input__inner),
.dictionary-management :deep(.el-input__wrapper input),
.dictionary-management :deep(.el-input input),
:deep(.el-input__inner),
:deep(.el-input__wrapper input),
:deep(.el-input input) {
  color: #fff !important;
}

.dictionary-management :deep(.el-input__inner::placeholder),
.dictionary-management :deep(.el-input__wrapper input::placeholder),
:deep(.el-input__inner::placeholder),
:deep(.el-input__wrapper input::placeholder) {
  color: rgba(255, 255, 255, 0.4) !important;
}

.dictionary-management :deep(.el-input__inner:focus),
.dictionary-management :deep(.el-input__wrapper.is-focus),
:deep(.el-input__inner:focus),
:deep(.el-input__wrapper.is-focus) {
  border-color: #409EFF !important;
}

.dictionary-management :deep(.el-input__inner:hover),
.dictionary-management :deep(.el-input__wrapper:hover),
:deep(.el-input__inner:hover),
:deep(.el-input__wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.3) !important;
}

/* 禁用状态的输入框 */
.dictionary-management :deep(.el-input.is-disabled .el-input__inner),
.dictionary-management :deep(.el-input.is-disabled .el-input__wrapper),
:deep(.el-input.is-disabled .el-input__inner),
:deep(.el-input.is-disabled .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05) !important;
  background-color: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.5) !important;
}

/* 选择框样式 */
.dictionary-management :deep(.el-select .el-input__inner),
.dictionary-management :deep(.el-select .el-input__wrapper),
:deep(.el-select .el-input__inner),
:deep(.el-select .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.1) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: #fff !important;
}

:deep(.el-select-dropdown) {
  background: #1e293b !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

:deep(.el-select-dropdown__item) {
  color: #fff !important;
}

:deep(.el-select-dropdown__item:hover) {
  background: rgba(255, 255, 255, 0.1) !important;
}

:deep(.el-select-dropdown__item.selected) {
  color: #409EFF !important;
}

/* 数字输入框 */
.dictionary-management :deep(.el-input-number),
.dictionary-management :deep(.el-input-number__input),
.dictionary-management :deep(.el-input-number .el-input__inner),
.dictionary-management :deep(.el-input-number .el-input__wrapper),
:deep(.el-input-number),
:deep(.el-input-number__input),
:deep(.el-input-number .el-input__inner),
:deep(.el-input-number .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.1) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.dictionary-management :deep(.el-input-number__decrease),
.dictionary-management :deep(.el-input-number__increase),
:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  background: rgba(255, 255, 255, 0.1) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

.dictionary-management :deep(.el-input-number__decrease:hover),
.dictionary-management :deep(.el-input-number__increase:hover),
:deep(.el-input-number__decrease:hover),
:deep(.el-input-number__increase:hover) {
  background: rgba(255, 255, 255, 0.15) !important;
  background-color: rgba(255, 255, 255, 0.15) !important;
}

/* 开关 */
:deep(.el-switch__core) {
  background: rgba(255, 255, 255, 0.2) !important;
}

/* 标签页 */
:deep(.el-tabs__item) {
  color: rgba(255, 255, 255, 0.6) !important;
}

:deep(.el-tabs__item.is-active) {
  color: #409EFF !important;
}

:deep(.el-tabs__active-bar) {
  background: #409EFF !important;
}

:deep(.el-tabs__nav-wrap::after) {
  background: rgba(255, 255, 255, 0.1) !important;
}

/* 空状态提示 */
.empty-tip {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}
</style>

