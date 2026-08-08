<script setup lang="ts">
import {
  ElementPlusDocsDemo,
} from '@moluoxixi/vitepress-theme-element-plus'
import { docsRoutePath } from '../../docs-site'
import { createPlaygroundSession, playgroundSessionQuery } from './playground-session'
import { compileLocalSfc } from './sfc-compiler'
import { useDocsLocale } from '../composables/use-docs-locale'

const props = defineProps<{
  code: string
  demoId: string
  highlighted: string
  title?: string
}>()
const { link, messages } = useDocsLocale()

function copySource(source: string): Promise<void> {
  return copyText(source)
}

function openPlayground(source: string, demoId: string): void {
  const token = createPlaygroundSession(source, demoId)
  const query = new URLSearchParams({ [playgroundSessionQuery]: token })
  window.location.assign(`${link(docsRoutePath('playground'))}?${query.toString()}`)
}
</script>

<template>
  <ElementPlusDocsDemo
    v-bind="props"
    :compile="compileLocalSfc"
    :copy="copySource"
    :messages="messages.demo"
    :open-playground="openPlayground"
  />
</template>
