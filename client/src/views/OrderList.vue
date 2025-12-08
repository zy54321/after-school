<template>
  <div class="order-list-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <div class="title">💰 订单流水</div>
          <el-button type="success" icon="Download" @click="exportToExcel">导出 Excel</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading" id="order-table">
        <el-table-column prop="id" label="单号" width="80" />
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="scope">
            {{ new Date(scope.row.created_at).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="student_name" label="学员" width="120" />
        <el-table-column prop="class_name" label="购买课程" width="180" />
        
        <el-table-column label="交易内容" width="150">
          <template #default="scope">
            <span v-if="scope.row.billing_type === 'time'">
              包期: {{ scope.row.quantity }} 个月
            </span>
            <span v-else>
              课时: {{ scope.row.quantity }} 节
            </span>
          </template>
        </el-table-column>

        <el-table-column label="实收金额" width="120">
          <template #default="scope">
            <span style="color: #67C23A; font-weight: bold;">
              ¥ {{ (scope.row.amount / 100).toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="remark" label="备注" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Download } from '@element-plus/icons-vue'; // 引入图标
import * as XLSX from 'xlsx'; // 引入 xlsx 库

const tableData = ref([]);
const loading = ref(false);

const fetchOrders = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/orders');
    if (res.data.code === 200) {
      tableData.value = res.data.data;
    }
  } finally {
    loading.value = false;
  }
};

// ⭐ 核心功能：导出 Excel
const exportToExcel = () => {
  if (tableData.value.length === 0) {
    return;
  }

  // 1. 数据清洗：把后端原始数据转换成中文表头的数据
  const dataToExport = tableData.value.map(item => ({
    '单号': item.id,
    '时间': new Date(item.created_at).toLocaleString(),
    '学员姓名': item.student_name,
    '购买课程': item.class_name,
    '类型': item.billing_type === 'time' ? '包月' : '按次',
    '数量': item.quantity,
    '实收金额(元)': (item.amount / 100).toFixed(2),
    '备注': item.remark || '-'
  }));

  // 2. 创建 Worksheet
  const ws = XLSX.utils.json_to_sheet(dataToExport);

  // 3. 创建 Workbook 并添加 Worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "订单流水表");

  // 4. 生成文件名 (带上当前日期)
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `托管班_财务流水_${dateStr}.xlsx`;

  // 5. 触发下载
  XLSX.writeFile(wb, fileName);
};

onMounted(() => {
  fetchOrders();
});
</script>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; }
.title { font-weight: bold; font-size: 18px; }
</style>