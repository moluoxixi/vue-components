<script setup lang="ts">
import { provideDocsUi } from '../../../runtime/provide-docs-ui'
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
provideDocsUi()
</script>

<template>
  <el-result data-docs-ui icon="error" :title="locale.title" :sub-title="locale.desc ?? locale.quote">
    <template #extra>
      <el-button @click="goHome">{{ locale['button-title'] ?? locale.linkText }}</el-button>
    </template>
  </el-result>
</template>

<style scoped>
.epd-result {
  height: 100vh;
  width: 100vw;
}
</style>
