<script setup lang="ts">
import { Folder, Monitor, Unplug } from '@lucide/vue'
import { computed } from 'vue'
import './style/index.css'

const props = defineProps<{ storage: { mode: 'browser' | 'local', name: string, connected: boolean }, locale?: string }>()
const chinese = computed(() => props.locale !== 'en-US')
const label = computed(() => !props.storage.connected
  ? chinese.value ? '工作区已断开' : 'Workspace disconnected'
  : props.storage.mode === 'local' ? props.storage.name : chinese.value ? '当前浏览器' : 'This browser')
const detail = computed(() => props.storage.mode === 'local'
  ? `${props.storage.name} · ${chinese.value ? '本地共享工作区' : 'Shared local workspace'}`
  : chinese.value ? '项目保存在当前浏览器。使用本地工作区可以在多个浏览器和 AI 工具间共享。' : 'Projects are stored in this browser. A local workspace shares projects with other browsers and AI tools.')
</script>

<template>
  <span class="workspace-status" :class="{ 'is-disconnected': !storage.connected }" :title="detail" role="status" aria-live="polite">
    <Unplug v-if="!storage.connected" :size="13" aria-hidden="true" />
    <Folder v-else-if="storage.mode === 'local'" :size="13" aria-hidden="true" />
    <Monitor v-else :size="13" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>
