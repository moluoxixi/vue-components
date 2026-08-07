<script setup lang="ts">
import { computed } from 'vue'
import { isClient } from '@vueuse/core'
import { useData, withBase } from 'vitepress'
import { useSiteLocales } from '../composables/site-locale'
import localeData from '../../../i18n/pages/not-found.json'

const { homePath, lang } = useSiteLocales()
const { theme } = useData()

const locale = computed(() => theme.value.notFound ?? localeData[lang.value] ?? localeData['en-US'])

const goHome = () => {
  if (!isClient) return
  window.location.href = withBase(homePath.value)
}
</script>

<template>
  <el-result icon="error" :title="locale.title" :sub-title="locale.desc ?? locale.quote">
    <template #extra>
      <el-button @click="goHome">{{ locale['button-title'] ?? locale.linkText }}</el-button>
    </template>
  </el-result>
</template>

<style scoped>
.el-result {
  height: 100vh;
  width: 100vw;
}
</style>
