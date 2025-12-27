<template>
  <div class="p-4">
    <el-card shadow="hover" class="mb-4">
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold flex items-center">
          <span class="mr-2">🍲</span> 菜品库
        </div>
        <el-button type="primary" icon="Plus" @click="openAddDialog">研发新菜</el-button>
      </div>
    </el-card>

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
              <div class="font-bold mb-1">配方表:</div>
              <div v-for="ing in dish.ingredients" :key="ing.ingredient_id"
                class="flex justify-between border-b border-gray-200 py-1 last:border-0">
                <span>{{ ing.name }}</span>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑菜品' : '研发新菜'" width="600px">
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
          <div class="text-xs text-gray-400 mt-1">支持 jpg/png，大小不超过 2MB</div>
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
            <span class="font-bold text-blue-700">所需食材 (用于生成采购单 & 避险)</span>
            <el-button size="small" type="primary" link icon="Plus" @click="addIngredientRow">添加一行</el-button>
          </div>

          <div v-for="(item, index) in form.ingredients" :key="index" class="flex gap-2 mb-2 items-center">
            <el-select v-model="item.id" placeholder="选择食材" filterable class="flex-1">
              <el-option v-for="ing in ingredientList" :key="ing.id"
                :label="ing.name + (ing.allergen_type !== '无' ? ' ⚠️' : '')" :value="ing.id" />
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, Edit } from '@element-plus/icons-vue'; // ⭐ 引入 Edit 图标

const loading = ref(false);
const dishes = ref([]);
const ingredientList = ref([]); // 所有可选食材
const dialogVisible = ref(false);

// 新增编辑状态标识
const isEdit = ref(false);
const editingId = ref(null);

const form = reactive({
  name: '', photo_url: '', description: '', tags: [], ingredients: []
});

// 上传成功回调
const handleAvatarSuccess = (response, uploadFile) => {
  if (response.code === 200) {
    form.photo_url = response.url; // 后端返回的相对路径
    ElMessage.success('图片上传成功');
  } else {
    ElMessage.error('上传失败');
  }
};

// 上传前校验
const beforeAvatarUpload = (rawFile) => {
  if (rawFile.type !== 'image/jpeg' && rawFile.type !== 'image/png') {
    ElMessage.error('只能上传 JPG 或 PNG 格式!');
    return false;
  } else if (rawFile.size / 1024 / 1024 > 2) {
    ElMessage.error('图片大小不能超过 2MB!');
    return false;
  }
  return true;
};

// 获取基础数据
const fetchData = async () => {
  try {
    const [resDishes, resIngs] = await Promise.all([
      axios.get('/api/catering/dishes'),
      axios.get('/api/catering/ingredients')
    ]);
    if (resDishes.data.code === 200) dishes.value = resDishes.data.data;
    if (resIngs.data.code === 200) ingredientList.value = resIngs.data.data;
  } catch (err) { console.error(err); }
};

// 辅助: 获取选中食材的单位
const getUnit = (ingId) => {
  const target = ingredientList.value.find(i => i.id === ingId);
  return target ? target.unit : '';
};

// 打开新增弹窗
const openAddDialog = () => {
  isEdit.value = false;
  editingId.value = null;
  // 重置表单
  Object.assign(form, { name: '', photo_url: '', description: '', tags: ['清淡'], ingredients: [{ id: null, quantity: 1 }] });
  dialogVisible.value = true;
};

// ⭐ 修改点 3：打开编辑弹窗 (含数据回填逻辑)
const openEditDialog = (row) => {
  isEdit.value = true;
  editingId.value = row.id;

  // 回填基础信息
  form.name = row.name;
  form.photo_url = row.photo_url;
  form.description = row.description;
  form.tags = row.tags || [];

  // 回填配方 (数据结构转换)
  // 数据库出来的是 { ingredient_id: 1, quantity: 2, ... }
  // 表单需要的是 { id: 1, quantity: 2 }
  if (row.ingredients && row.ingredients.length > 0) {
    form.ingredients = row.ingredients.map(i => ({
      id: i.ingredient_id,
      quantity: Number(i.quantity)
    }));
  } else {
    form.ingredients = [{ id: null, quantity: 1 }];
  }

  dialogVisible.value = true;
};

// 动态表单操作
const addIngredientRow = () => form.ingredients.push({ id: null, quantity: 1 });
const removeIngredientRow = (idx) => form.ingredients.splice(idx, 1);

// ⭐ 修改点 4：提交逻辑 (支持新增和更新)
const handleSubmit = async () => {
  if (!form.name) return ElMessage.warning('菜名必填');
  // 过滤掉没选食材的空行
  const validIngredients = form.ingredients.filter(i => i.id);

  try {
    const payload = { ...form, ingredients: validIngredients };
    let res;

    if (isEdit.value) {
      // 编辑模式：发 PUT 请求
      res = await axios.put(`/api/catering/dishes/${editingId.value}`, payload);
    } else {
      // 新增模式：发 POST 请求
      res = await axios.post('/api/catering/dishes', payload);
    }

    if (res.data.code === 200) {
      ElMessage.success(isEdit.value ? '更新成功' : '研发成功');
      dialogVisible.value = false;
      fetchData();
    }
  } catch (err) { ElMessage.error('保存失败'); }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除这道菜吗?');
    const res = await axios.delete(`/api/catering/dishes/${row.id}`);
    if (res.data.code === 200) {
      ElMessage.success('已删除');
      fetchData();
    }
  } catch (err) { /* cancel */ }
};

onMounted(fetchData);
</script>

<style scoped>
/* 👇 使用 :deep() 穿透组件内部样式 */
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
  /* 垂直居中 */
}

.avatar {
  width: 100px;
  height: 100px;
  display: block;
  object-fit: cover;
}
</style>