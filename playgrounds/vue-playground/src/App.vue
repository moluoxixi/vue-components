<script setup lang="ts">
import { ElementPlusDocsRepl } from '@moluoxixi/vitepress-theme-element-plus/repl'

const assetUrl = (path: string): string => new URL(
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`,
  window.location.origin,
).toString()

const starterSource = `<script setup lang="ts">
import { ref } from 'vue'
import { ElInput } from 'element-plus'
import { CopyText } from '@moluoxixi/components'

const text = ref('Hello, MX Components!')
<\/script>

<template>
  <div class="playground-example">
    <ElInput v-model="text" aria-label="Text to copy" />
    <CopyText :text="text" />
  </div>
</template>

<style scoped>
.playground-example {
  display: flex;
  max-width: 520px;
  gap: 12px;
  align-items: center;
}
</style>
`

const componentPackage = {
  moduleUrl: assetUrl('runtime/moluoxixi-components.js'),
  name: '@moluoxixi/components',
  styleUrls: [
    'https://cdn.jsdelivr.net/npm/element-plus@#ELEMENT_PLUS_VERSION#/dist/index.css',
    'https://cdn.jsdelivr.net/npm/element-plus@#ELEMENT_PLUS_VERSION#/theme-chalk/dark/css-vars.css',
    assetUrl('runtime/moluoxixi-components.css'),
  ],
}
</script>

<template>
  <ElementPlusDocsRepl
    :component-package="componentPackage"
    :starter-source="starterSource"
    repository-url="https://github.com/moluoxixi/vue-components"
    title="MX Components Playground"
  />
</template>
