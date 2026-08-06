<script setup lang="ts">
import { ElConfigProvider } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import DefaultTheme from 'vitepress/theme'
import { computed } from 'vue'
import { useDocsLocale } from './use-docs-locale'

const DefaultLayout = DefaultTheme.Layout
const { locale } = useDocsLocale()
const elementLocale = computed(() => locale.value === 'zh-CN' ? zhCn : en)
</script>

<template>
  <ElConfigProvider :locale="elementLocale">
    <DefaultLayout />
  </ElConfigProvider>
</template>
