<template>
  <div class="order-list-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <div class="title">💰 {{ $t('order.title') }}</div>
          <el-button type="success" icon="Download" @click="exportToExcel">{{ $t('order.exportBtn') }}</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading" id="order-table">
        <el-table-column prop="id" :label="$t('order.colId')" width="80" />
        <el-table-column prop="created_at" :label="$t('order.colTime')" width="180">
          <template #default="scope">
            {{ new Date(scope.row.created_at).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="student_name" :label="$t('order.colStudent')" width="120" />
        <el-table-column prop="class_name" :label="$t('order.colClass')" width="180" />

        <el-table-column :label="$t('order.colContent')" width="150">
          <template #default="scope">
            <span v-if="scope.row.billing_type === 'time'">
              {{ $t('order.typeTime') }}: {{ scope.row.quantity }} {{ $t('order.unitMonth') }}
            </span>
            <span v-else>
              {{ $t('order.typeCount') }}: {{ scope.row.quantity }} {{ $t('order.unitLesson') }}
            </span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('order.colAmount')" width="120">
          <template #default="scope">
            <span style="color: #67C23A; font-weight: bold;">
              ¥ {{ (scope.row.amount / 100).toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="remark" :label="$t('order.colRemark')" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Download } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

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

const exportToExcel = () => {
  if (tableData.value.length === 0) return;
  const dataToExport = tableData.value.map(item => ({
    [t('order.colId')]: item.id,
    [t('order.colTime')]: new Date(item.created_at).toLocaleString(),
    [t('order.colStudent')]: item.student_name,
    [t('order.colClass')]: item.class_name,
    [t('order.colAmount')]: (item.amount / 100).toFixed(2),
    [t('order.colRemark')]: item.remark || '-'
  }));
  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
};

onMounted(() => {
  fetchOrders();
});
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-weight: bold;
  font-size: 18px;
}
</style>