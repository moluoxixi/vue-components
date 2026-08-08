<script setup lang="ts">
import { ChevronDown, List } from '@lucide/vue'
import { ElPopover, type Measurable } from 'element-plus'
import { computed, nextTick, ref } from 'vue'
import { useLang } from '../../composables/lang'
import { useToc } from '../../composables/use-toc'
import VPTableOfContentLinks from './vp-table-of-content-links.vue'

const headers = useToc()
const lang = useLang()
const isCompactOpen = ref(false)
const compactTrigger = ref<HTMLButtonElement>()
const compactPanelId = 'toc-compact-panel'
const desktopPanelId = 'toc-desktop-panel'
const label = computed(() => lang.value.toLowerCase().startsWith('zh') ? '本页目录' : 'On this page')
const emptyRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect
const compactVirtualRef: Measurable = {
  getBoundingClientRect: () => compactTrigger.value?.getBoundingClientRect() ?? emptyRect,
}

function closeCompactToc(restoreFocus = false) {
  isCompactOpen.value = false
  if (restoreFocus)
    void nextTick(() => compactTrigger.value?.focus())
}

function handleCompactPanelClick(event: MouseEvent) {
  if ((event.target as Element).closest('a'))
    closeCompactToc()
}

function handleCompactPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape')
    return
  event.preventDefault()
  event.stopPropagation()
  closeCompactToc(true)
}
</script>

<template>
  <aside ref="container" class="toc-wrapper">
    <ClientOnly>
      <button
        ref="compactTrigger"
        class="toc-compact-trigger"
        type="button"
        aria-haspopup="dialog"
        :aria-controls="isCompactOpen ? compactPanelId : undefined"
        :aria-expanded="isCompactOpen"
        @click="isCompactOpen = !isCompactOpen"
        @keydown.esc="closeCompactToc(true)"
      >
        <List aria-hidden="true" class="toc-compact-trigger__icon" />
        <span>{{ label }}</span>
        <span class="toc-compact-trigger__hint" aria-hidden="true">{{ headers.length }}</span>
        <ChevronDown aria-hidden="true" class="toc-compact-trigger__chevron" />
      </button>

      <ElPopover
        v-model:visible="isCompactOpen"
        :offset="8"
        :persistent="false"
        :show-arrow="false"
        :title="label"
        :virtual-ref="compactVirtualRef"
        placement="bottom-start"
        popper-class="toc-compact-popper"
        role="dialog"
        trigger="click"
        virtual-triggering
        width="auto"
      >
        <div class="toc-compact-panel">
          <div class="toc-compact-panel__header" aria-hidden="true">
            <span class="toc-compact-panel__title">{{ label }}</span>
            <span class="toc-compact-panel__count">{{ headers.length }}</span>
          </div>
          <nav
            :id="compactPanelId"
            class="toc-compact-panel__content"
            :aria-label="label"
            tabindex="-1"
            @click="handleCompactPanelClick"
            @keydown="handleCompactPanelKeydown"
          >
            <VPTableOfContentLinks :headers="headers" />
          </nav>
        </div>
      </ElPopover>
    </ClientOnly>
    <nav
      :id="desktopPanelId"
      class="toc-content toc-content--desktop"
      :aria-label="label"
    >
      <h3 class="toc-content__heading">{{ label }}</h3>
      <VPTableOfContentLinks :headers="headers" />
    </nav>
    <div class="toc-content-mask" />
  </aside>
</template>
