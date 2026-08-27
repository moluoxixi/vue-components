<script setup lang="ts">
import type { ImportMap, StoreState } from '@vue/repl/core'
import type { Component } from 'vue'
import type { WorkspaceProject } from '../project'
import { Repl } from '@vue/repl'
import { compileFile, File, useStore } from '@vue/repl/core'
import { computed, defineComponent, h, onMounted, reactive, ref, toRefs } from 'vue'
import { normalizeProjectPath } from '../project'

const props = defineProps<{
  project: WorkspaceProject
}>()

const appFile = 'src/App.vue'
const mainFile = 'src/__workbench_preview.vue'
const ready = ref(false)
const mainSource = `<script setup>
import App from './App.vue'
import './styles.css'
<\/script>

<template><App /></template>
`
const PreviewOnlyEditor = defineComponent({
  name: 'PreviewOnlyEditor',
  inheritAttrs: false,
  setup(_, { expose }) {
    expose({
      getEditorIns: () => undefined,
      getMonacoEditor: () => undefined,
    })
    return () => h('div', { 'aria-hidden': 'true' })
  },
}) as Component

function source(path: string): string {
  const file = props.project.files[normalizeProjectPath(path)]
  return file?.kind === 'text' ? file.content : ''
}

const adapterPackage = props.project.manifest.adapter === 'element-plus'
  ? '@moluoxixi/config-form-element'
  : '@moluoxixi/config-form-antd-vue'
const adapterVersion = props.project.manifest.adapter === 'element-plus' ? '0.2.4' : '0.2.3'
const uiDependency = props.project.manifest.adapter === 'element-plus'
  ? 'element-plus@2.9.1'
  : 'ant-design-vue@4.2.6'
const uiStyle = props.project.manifest.adapter === 'element-plus'
  ? 'https://cdn.jsdelivr.net/npm/element-plus@2.9.1/dist/index.css'
  : 'https://cdn.jsdelivr.net/npm/ant-design-vue@4.2.6/dist/reset.css'
const adapterStyle = `https://cdn.jsdelivr.net/npm/${adapterPackage}@${adapterVersion}/dist/index.css`
const previewHead = `<link rel="stylesheet" href="${uiStyle}"><link rel="stylesheet" href="${adapterStyle}">`
const importMap: ImportMap = {
  imports: {
    [adapterPackage]: `https://esm.sh/${adapterPackage}@${adapterVersion}?deps=vue@3.5.33,${uiDependency},zod@3.24.2`,
    '@moluoxixi/config-form-headless': 'https://esm.sh/@moluoxixi/config-form-headless@0.2.4?deps=vue@3.5.33,zod@3.24.2',
    'vue': 'https://esm.sh/vue@3.5.33',
  },
}
const files: Record<string, File> = {
  [appFile]: new File(appFile, source(appFile)),
  [props.project.manifest.generatedFormModule]: new File(
    props.project.manifest.generatedFormModule,
    source(props.project.manifest.generatedFormModule),
  ),
  'import-map.json': new File('import-map.json', JSON.stringify(importMap, null, 2)),
  'src/styles.css': new File('src/styles.css', source('src/styles.css')),
  'tsconfig.json': new File('tsconfig.json', JSON.stringify({
    compilerOptions: {
      allowJs: true,
      jsx: 'preserve',
      jsxImportSource: 'vue',
      moduleResolution: 'Bundler',
    },
  }, null, 2)),
  [mainFile]: new File(mainFile, mainSource, true),
}
const builtinImportMap = computed<ImportMap>(() => importMap)
const state = toRefs(reactive({
  activeFilename: appFile,
  builtinImportMap,
  files,
  mainFile,
  outputMode: 'preview',
  sfcOptions: { script: { propsDestructure: true } },
  showOutput: true,
  template: { welcomeSFC: mainSource },
  typescriptVersion: '5.9.2',
  vueVersion: '3.5.33',
})) as Partial<StoreState>
const store = useStore(state)
const errors = computed(() => store.errors.map(error => error instanceof Error ? error.message : String(error)))

store.init = () => {
  store.errors = []
  Object.values(store.files).forEach((file) => {
    void compileFile(store, file).then((errors) => {
      store.errors.push(...errors)
    })
  })
}

onMounted(async () => {
  const compilerUrl = 'https://cdn.jsdelivr.net/npm/@vue/compiler-sfc@3.5.33/dist/compiler-sfc.esm-browser.js'
  store.compiler = await import(
    /* @vite-ignore */ compilerUrl
  )
  store.vueVersion = '3.5.33'
  ready.value = true
})
</script>

<template>
  <div class="workspace-source-preview">
    <div v-if="!ready" class="source-preview-loading" role="status">Compiling page...</div>
    <div v-if="errors.length" class="source-preview-errors" role="alert">
      <strong>Source preview failed</strong>
      <p v-for="error in errors" :key="error">{{ error }}</p>
    </div>
    <Repl
      v-else
      :key="`${project.id}-${project.revision}`"
      :editor="PreviewOnlyEditor"
      :store="store"
      :editor-options="{ autoSaveText: false, showErrorText: false }"
      :preview-options="{
        headHTML: previewHead,
        showRuntimeError: true,
        showRuntimeWarning: true,
      }"
      auto-resize
      clear-console
    />
  </div>
</template>

<style scoped>
.workspace-source-preview,
.workspace-source-preview :deep(.sandbox-container),
.workspace-source-preview :deep(iframe) {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
}

.workspace-source-preview {
  position: relative;
}

.workspace-source-preview :deep(.split-pane > .left),
.workspace-source-preview :deep(.split-pane > .dragger),
.workspace-source-preview :deep(.split-pane > .toggler) {
  display: none !important;
}

.workspace-source-preview :deep(.split-pane > .right) {
  width: 100% !important;
  height: 100% !important;
}

.workspace-source-preview :deep(.output-container) {
  height: 100%;
}

.workspace-source-preview :deep(.output-container > .tab-buttons) {
  display: none;
}

.source-preview-errors {
  position: absolute;
  z-index: 3;
  inset: 0;
  padding: 16px;
  overflow: auto;
  color: #9f2d24;
  background: #fff;
}

.source-preview-loading {
  display: grid;
  height: 100%;
  place-items: center;
  color: #667281;
  background: #fff;
  font-size: 13px;
}

.source-preview-errors p {
  margin: 8px 0 0;
  font: 12px/1.5 "Cascadia Code", Consolas, monospace;
  white-space: pre-wrap;
}
</style>
