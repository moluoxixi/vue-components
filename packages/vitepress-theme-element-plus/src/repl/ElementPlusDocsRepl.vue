<script setup lang="ts">
import type { ElementPlusDocsReplProps, ElementPlusDocsReplVersionKey } from './types'
import Monaco from '@vue/repl/monaco-editor'
import { Repl as VueRepl } from '@vue/repl'
import { Check, Copy, GitBranch, Moon, RefreshCw, RotateCcw, Sun } from '@lucide/vue'
import { computed, onMounted, ref, watchEffect } from 'vue'
import { fetchElementPlusDocsPackageVersions } from './dependency'
import { createElementPlusDocsReplStore } from './store'

const props = withDefaults(defineProps<ElementPlusDocsReplProps>(), {
  elementPlusVersion: '2.9.1',
  repositoryUrl: undefined,
  serializedState: undefined,
  typescriptVersion: '5.9.2',
  vueVersion: '3.5.33',
})

const loading = ref(true)
const dark = ref(new URLSearchParams(location.search).get('theme') === 'dark')
const copied = ref(false)
const replRef = ref<InstanceType<typeof VueRepl>>()
const vueVersions = ref<string[]>([props.vueVersion])
const elementPlusVersions = ref<string[]>([props.elementPlusVersion])
const store = createElementPlusDocsReplStore({
  componentPackage: props.componentPackage,
  elementPlusVersion: props.elementPlusVersion,
  initialized: () => {
    loading.value = false
  },
  serializedState: props.serializedState ?? location.hash.slice(1),
  starterSource: props.starterSource,
  typescriptVersion: props.typescriptVersion,
  vueVersion: props.vueVersion,
})

const previewHead = computed(() => props.componentPackage.styleUrls
  ?.map(url => url.replaceAll('#ELEMENT_PLUS_VERSION#', store.versions.elementPlus))
  .map(url => `<link rel="stylesheet" href="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`)
  .join('\n') ?? '')

async function setVersion(key: ElementPlusDocsReplVersionKey, event: Event): Promise<void> {
  const version = (event.target as HTMLSelectElement).value
  loading.value = key === 'vue'
  try {
    await store.setVersion(key, version)
    replRef.value?.reload()
  }
  finally {
    loading.value = false
  }
}

function resetFiles(): void {
  store.resetFiles()
  replRef.value?.reload()
}

async function copyLink(): Promise<void> {
  await navigator.clipboard.writeText(location.href)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}

function toggleTheme(): void {
  dark.value = !dark.value
  document.documentElement.classList.toggle('dark', dark.value)
}

watchEffect(() => {
  const hash = store.serialize()
  history.replaceState({}, '', `${location.pathname}${location.search}#${hash}`)
})

onMounted(async () => {
  document.documentElement.classList.toggle('dark', dark.value)
  const [vue, elementPlus] = await Promise.allSettled([
    fetchElementPlusDocsPackageVersions('vue'),
    fetchElementPlusDocsPackageVersions('element-plus'),
  ])
  if (vue.status === 'fulfilled')
    vueVersions.value = vue.value
  if (elementPlus.status === 'fulfilled')
    elementPlusVersions.value = elementPlus.value
})
</script>

<template>
  <main class="mx-repl" :class="{ 'is-loading': loading }">
    <header class="mx-repl__header">
      <div class="mx-repl__brand">
        <span class="mx-repl__mark" aria-hidden="true">MX</span>
        <div>
          <strong>{{ title }}</strong>
          <small>{{ componentPackage.name }}{{ componentPackage.version ? ` v${componentPackage.version}` : '' }}</small>
        </div>
      </div>

      <div class="mx-repl__versions" aria-label="Runtime versions">
        <label>
          <span>Vue</span>
          <select :value="store.versions.vue" @change="setVersion('vue', $event)">
            <option v-for="version in vueVersions" :key="version" :value="version">{{ version }}</option>
          </select>
        </label>
        <label>
          <span>Element Plus</span>
          <select :value="store.versions.elementPlus" @change="setVersion('elementPlus', $event)">
            <option v-for="version in elementPlusVersions" :key="version" :value="version">{{ version }}</option>
          </select>
        </label>
      </div>

      <nav class="mx-repl__actions" aria-label="Playground actions">
        <button type="button" title="Reset files" aria-label="Reset files" @click="resetFiles">
          <RotateCcw :size="18" />
        </button>
        <button type="button" title="Refresh preview" aria-label="Refresh preview" @click="replRef?.reload()">
          <RefreshCw :size="18" />
        </button>
        <button type="button" title="Copy share link" aria-label="Copy share link" @click="copyLink">
          <Check v-if="copied" :size="18" />
          <Copy v-else :size="18" />
        </button>
        <button type="button" title="Toggle theme" aria-label="Toggle theme" @click="toggleTheme">
          <Sun v-if="dark" :size="18" />
          <Moon v-else :size="18" />
        </button>
        <a v-if="repositoryUrl" :href="repositoryUrl" target="_blank" rel="noreferrer" title="View repository" aria-label="View repository">
          <GitBranch :size="18" />
        </a>
      </nav>
    </header>

    <div v-if="loading" class="mx-repl__loading" role="status">Loading playground…</div>
    <VueRepl
      v-else
      ref="replRef"
      :editor="Monaco"
      :store="store"
      :theme="dark ? 'dark' : 'light'"
      :preview-theme="true"
      :preview-options="{ headHTML: previewHead, showRuntimeError: true, showRuntimeWarning: true }"
      :editor-options="{ autoSaveText: 'Auto save', showErrorText: 'Show errors' }"
      auto-resize
      clear-console
      show-import-map
      show-ts-config
    />
  </main>
</template>
