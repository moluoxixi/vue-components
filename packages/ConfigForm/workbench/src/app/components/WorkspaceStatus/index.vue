<script setup lang="ts">
import { Folder, Monitor, Unplug } from '@lucide/vue'
import { computed, useTemplateRef } from 'vue'
import './style/index.css'

const props = defineProps<{ storage: { mode: 'browser' | 'local', name: string, connected: boolean }, locale?: string }>()
const storageTooltip = useTemplateRef<{ hide: () => void, onOpen: (event?: Event) => void, onClose: (event?: Event) => void }>('storageTooltip')
const chinese = computed(() => props.locale !== 'en-US')
const label = computed(() => !props.storage.connected
  ? chinese.value ? '存储：工作区已断开' : 'Storage: disconnected'
  : props.storage.mode === 'local'
    ? chinese.value ? '存储：本地工作区' : 'Storage: workspace'
    : chinese.value ? '存储：浏览器本地' : 'Storage: browser')
const details = computed(() => {
  if (!props.storage.connected) {
    return chinese.value
      ? [`本地工作区「${props.storage.name}」连接已断开。`, '请启动或恢复本地工作区服务，连接恢复后再继续保存。']
      : [`The connection to local workspace “${props.storage.name}” was lost.`, 'Start or restore the local workspace service, then resume saving once connected.']
  }
  if (props.storage.mode === 'local') {
    return chinese.value
      ? [`项目保存在本机工作区「${props.storage.name}」。`, '连接此工作区的浏览器和 AI 工具可读取同一份项目。']
      : [`Projects are stored in local workspace “${props.storage.name}” on this computer.`, 'Browsers and AI tools connected to this workspace can access the same projects.']
  }
  return chinese.value
    ? ['项目保存在当前浏览器，刷新或重新打开后仍可使用。', '不会自动同步到其他浏览器或设备；清除网站数据会移除本地项目。', '备份或迁移：通过项目操作导出 JSON，再导入目标浏览器。']
    : ['Projects stay in this browser after a refresh or reopening.', 'They do not sync automatically to other browsers or devices. Clearing site data removes these projects.', 'To back up or move a project, export JSON from its actions menu, then import it in the destination browser.']
})

function openDetails(event: MouseEvent): void {
  // Safari does not focus buttons after a tap; keep Escape and blur available.
  ;(event.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
  storageTooltip.value?.onOpen(event)
}
</script>

<template>
  <ElTooltip
    ref="storageTooltip"
    effect="light"
    placement="bottom-end"
    transition="none"
    :trigger="[]"
    :trigger-keys="[]"
    :show-after="200"
    :hide-after="0"
    :enterable="false"
    :persistent="false"
    append-to="#workbench-overlays"
    popper-class="workspace-storage-tooltip"
  >
    <button
      type="button"
      class="workspace-status"
      :class="{ 'is-disconnected': !props.storage.connected }"
      :aria-label="label"
      @mouseenter="storageTooltip?.onOpen($event)"
      @mouseleave="storageTooltip?.onClose($event)"
      @focus="storageTooltip?.onOpen($event)"
      @blur="storageTooltip?.onClose($event)"
      @click="openDetails"
      @keydown.esc.stop="storageTooltip?.hide()"
    >
      <Unplug v-if="!props.storage.connected" :size="14" aria-hidden="true" />
      <Folder v-else-if="props.storage.mode === 'local'" :size="14" aria-hidden="true" />
      <Monitor v-else :size="14" aria-hidden="true" />
      <span role="status" aria-live="polite">{{ label }}</span>
    </button>
    <template #content>
      <div class="workspace-storage-tooltip__content">
        <strong>{{ chinese ? '存储位置' : 'Storage location' }}</strong>
        <p v-for="detail in details" :key="detail">
          {{ detail }}
        </p>
      </div>
    </template>
  </ElTooltip>
</template>
