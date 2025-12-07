<template>
  <div class="order-list-container">
    <el-card shadow="never">
      <template #header>
        <div class="title">💰 订单流水</div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
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

onMounted(() => {
  fetchOrders();
});
</script>

<style scoped>
.title { font-weight: bold; font-size: 18px; }
</style>