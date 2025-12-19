<template>
  <el-config-provider :locale="elementPlusLocale">
    <router-view></router-view>
  </el-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'

const { locale } = useI18n()

// Element Plus 语言映射
const elementPlusLocaleMap = {
  zh: zhCn,
  en: en
}

// 根据当前语言返回对应的 Element Plus locale
const elementPlusLocale = computed(() => {
  return elementPlusLocaleMap[locale.value] || zhCn
})
</script>

<style>
/* 全局重置样式，去掉浏览器的默认边距 */
body {
  margin: 0;
  padding: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
}
</style>