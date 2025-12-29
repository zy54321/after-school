<template>
  <div class="h-[calc(100vh-110px)] flex flex-col p-4">

    <el-card shadow="hover" class="mb-4 flex-shrink-0">
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold flex items-center">
          <span class="mr-2">🍲</span> 菜品库
        </div>
        <div class="flex gap-2">
          <el-button type="warning" plain icon="DataBoard" @click="showStandardDialog">
            十人套餐标准表
          </el-button>
          <el-button type="primary" icon="Plus" @click="openAddDialog">研发新菜</el-button>
        </div>
      </div>
    </el-card>

    <div class="flex-1 overflow-y-auto pr-2">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="dish in dishes" :key="dish.id" class="mb-4">
          <el-card :body-style="{ padding: '0px' }" class="hover:shadow-lg transition-all relative group">
            <div class="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition flex gap-1">
              <el-button type="primary" circle size="small" icon="Edit" @click="openEditDialog(dish)" />
              <el-button type="danger" circle size="small" icon="Delete" @click="handleDelete(dish)" />
            </div>
            <div class="h-40 bg-gray-100 overflow-hidden relative">
              <img v-if="dish.photo_url" :src="dish.photo_url" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-400 text-4xl">🥘</div>
              <div class="absolute bottom-2 left-2 flex gap-1">
                <el-tag v-for="t in dish.tags" :key="t" size="small" effect="dark" type="success">{{ t }}</el-tag>
              </div>
            </div>
            <div class="p-4">
              <div class="font-bold text-lg mb-2">{{ dish.name }}</div>
              <div class="bg-gray-50 rounded p-2 text-xs text-gray-600 mb-2">
                <div class="font-bold mb-1">配方表 (基准:10人):</div>
                <div v-for="ing in dish.ingredients" :key="ing.ingredient_id"
                  class="flex justify-between items-center border-b border-gray-200 py-1 last:border-0">

                  <div class="flex items-center gap-1">
                    <span>{{ ing.name }}</span>
                    <el-tag v-if="ing.source" size="small" effect="plain" :type="getSourceTagType(ing.source)"
                      class="scale-75 origin-left px-1 h-5">
                      {{ ing.source }}
                    </el-tag>
                  </div>

                  <span>
                    {{ ing.quantity }}{{ ing.unit }}
                    <span v-if="ing.allergen_type !== '无'" class="text-red-500 font-bold ml-1">
                      ({{ ing.allergen_type }})
                    </span>
                  </span>
                </div>
                <div v-if="!dish.ingredients.length" class="text-gray-400">暂无配方</div>
              </div>
              <div class="text-gray-400 text-xs line-clamp-2">{{ dish.description || '暂无描述' }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑菜品' : '研发新菜'" width="600px">
      <el-alert type="info" show-icon :closable="false" class="mb-4">
        <template #title>
          请按 <b>“10人制套餐”</b> 的标准录入食材用量（即做一盆够10个孩子吃的量）。
        </template>
      </el-alert>
      <el-form :model="form" label-width="80px">
        <el-form-item label="菜品名称" required>
          <el-input v-model="form.name" placeholder="如: 西红柿炒蛋" />
        </el-form-item>
        <el-form-item label="菜品图片">
          <el-upload class="avatar-uploader" action="/api/catering/upload" :show-file-list="false"
            :on-success="handleAvatarSuccess" :before-upload="beforeAvatarUpload" name="file">
            <img v-if="form.photo_url" :src="form.photo_url" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon">
              <Plus />
            </el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="口味标签">
          <el-checkbox-group v-model="form.tags">
            <el-checkbox label="清淡" />
            <el-checkbox label="微辣" />
            <el-checkbox label="下饭" />
            <el-checkbox label="营养" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
        <div class="bg-blue-50 p-4 rounded-lg mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="font-bold text-blue-700">所需食材 (10人份用量)</span>
            <el-button size="small" type="primary" link icon="Plus" @click="addIngredientRow">添加一行</el-button>
          </div>
          <div v-for="(item, index) in form.ingredients" :key="index" class="flex gap-2 mb-2 items-center">

            <el-select v-model="item.id" placeholder="选择食材" filterable class="flex-1">
              <el-option v-for="ing in ingredientList" :key="ing.id"
                :label="`${ing.name} (¥${ing.price}/${ing.unit}) ${ing.allergen_type !== '无' ? '⚠️' : ''}`"
                :value="ing.id" />
            </el-select>

            <el-input-number v-model="item.quantity" :min="0" :step="0.1" :precision="2" controls-position="right"
              style="width: 100px" />
            <span class="text-xs text-gray-500 w-8">{{ getUnit(item.id) }}</span>
            <el-button type="danger" icon="Delete" circle size="small" @click="removeIngredientRow(index)" />
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ isEdit ? '更新信息' : '完成后厨入库' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="standardDialogVisible" title="📊 十人制套餐 · 黄金克数标准" width="700px">
      <div class="text-sm text-gray-500 mb-4">
        基于《中国学龄儿童膳食指南》，以下为 <b>10名小学生一顿午餐</b> 的推荐生鲜食材采购量（毛重）。
        <br>请后勤人员参照此标准录入，确保营养均衡且不浪费。
      </div>

      <el-table :data="standardData" border stripe>
        <el-table-column prop="category" label="食材类别" width="120" align="center">
          <template #default="{ row }">
            <span class="font-bold">{{ row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="standard" label="🔟 十人套餐标准量" width="180" align="center">
          <template #default="{ row }">
            <span class="text-blue-600 font-bold text-lg">{{ row.standard }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="执行口诀 / 备注" />
      </el-table>

      <div class="mt-4 bg-orange-50 p-3 rounded text-orange-800 text-xs border border-orange-100">
        💡 <b>提示：</b> 系统将根据“10人基准量”和“实际用餐人数”自动计算采购单，请严格按此标准录入基础数据。
      </div>

      <template #footer>
        <el-button type="primary" @click="standardDialogVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, Edit, DataBoard } from '@element-plus/icons-vue';

const loading = ref(false);
const dishes = ref([]);
const ingredientList = ref([]);
const dialogVisible = ref(false);
const standardDialogVisible = ref(false); // 标准表弹窗
const isEdit = ref(false);
const editingId = ref(null);
const form = reactive({ name: '', photo_url: '', description: '', tags: [], ingredients: [] });

// 黄金标准数据
const standardData = [
  { category: '🥩 肉禽鱼类', standard: '1.2 ~ 1.5 斤', remark: '纯肉/排骨重量。红烧牛肉建议1.5斤。' },
  { category: '🥚 蛋类', standard: '10 个', remark: '保证一人一个蛋。' },
  { category: '🥦 蔬菜类', standard: '3 ~ 4 斤', remark: '绿叶菜缩水严重，必须买足。' },
  { category: '🍚 谷薯类', standard: '1.5 ~ 2 斤', remark: '米饭/面条生重。' },
  { category: '🥛 豆制品', standard: '1 ~ 2 斤', remark: '豆腐/干子，优质蛋白。' },
];

const getSourceTagType = (source) => {
  if (['盒马鲜生', '山姆', '麦德龙'].includes(source)) return 'primary'; // 蓝
  if (['叮咚买菜', '朴朴'].includes(source)) return 'success'; // 绿
  return 'info'; // 灰
};

const handleAvatarSuccess = (response) => {
  if (response.code === 200) { form.photo_url = response.url; ElMessage.success('上传成功'); }
  else ElMessage.error('上传失败');
};
const beforeAvatarUpload = (file) => {
  const isImg = file.type === 'image/jpeg' || file.type === 'image/png';
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isImg || !isLt2M) ElMessage.error('只能传JPG/PNG且小于2MB');
  return isImg && isLt2M;
};

const fetchData = async () => {
  try {
    const [resDishes, resIngs] = await Promise.all([
      axios.get('/api/catering/dishes'),
      axios.get('/api/catering/ingredients')
    ]);
    if (resDishes.data.code === 200) dishes.value = resDishes.data.data;
    if (resIngs.data.code === 200) ingredientList.value = resIngs.data.data;
  } catch (e) { console.error(e); }
};

const getUnit = (id) => {
  const t = ingredientList.value.find(i => i.id === id);
  return t ? t.unit : '';
};

const showStandardDialog = () => { standardDialogVisible.value = true; };

const openAddDialog = () => {
  isEdit.value = false; editingId.value = null;
  Object.assign(form, { name: '', photo_url: '', description: '', tags: ['清淡'], ingredients: [{ id: null, quantity: 1 }] });
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true; editingId.value = row.id;
  form.name = row.name; form.photo_url = row.photo_url; form.description = row.description; form.tags = row.tags || [];
  if (row.ingredients && row.ingredients.length) {
    form.ingredients = row.ingredients.map(i => ({ id: i.ingredient_id, quantity: Number(i.quantity) }));
  } else {
    form.ingredients = [{ id: null, quantity: 1 }];
  }
  dialogVisible.value = true;
};

const addIngredientRow = () => form.ingredients.push({ id: null, quantity: 1 });
const removeIngredientRow = (idx) => form.ingredients.splice(idx, 1);

const handleSubmit = async () => {
  if (!form.name) return ElMessage.warning('菜名必填');
  const valid = form.ingredients.filter(i => i.id);
  try {
    const payload = { ...form, ingredients: valid };
    let res;
    if (isEdit.value) res = await axios.put(`/api/catering/dishes/${editingId.value}`, payload);
    else res = await axios.post('/api/catering/dishes', payload);
    if (res.data.code === 200) {
      ElMessage.success(isEdit.value ? '更新成功' : '研发成功');
      dialogVisible.value = false;
      fetchData();
    }
  } catch (e) { ElMessage.error('保存失败'); }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除?');
    const res = await axios.delete(`/api/catering/dishes/${row.id}`);
    if (res.data.code === 200) { ElMessage.success('已删除'); fetchData(); }
  } catch (e) { /* */ }
};

onMounted(fetchData);
</script>

<style scoped>
:deep(.avatar-uploader .el-upload) {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

:deep(.avatar-uploader .el-upload:hover) {
  border-color: var(--el-color-primary);
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 100px;
  height: 100px;
  text-align: center;
  line-height: 100px;
}

.avatar {
  width: 100px;
  height: 100px;
  display: block;
  object-fit: cover;
}
</style>