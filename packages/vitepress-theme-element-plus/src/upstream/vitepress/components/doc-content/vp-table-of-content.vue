<script setup lang="ts">
import { List, X } from '@lucide/vue'
import { ElDialog } from 'element-plus'
import { computed, ref } from 'vue'
import { useLang } from '../../composables/lang'
import { useToc } from '../../composables/use-toc'
import VPTableOfContentLinks from './vp-table-of-content-links.vue'

const headers = useToc()
const lang = useLang()
const isCompactOpen = ref(false)
const compactPanelId = 'toc-compact-panel'
const desktopPanelId = 'toc-desktop-panel'
const label = computed(() => lang.value.toLowerCase().startsWith('zh') ? '本页目录' : 'On this page')

function closeCompactToc() {
  isCompactOpen.value = false
}
</script>

<template>
  <aside ref="container" class="toc-wrapper">
    <button
      class="toc-compact-trigger"
      type="button"
      :aria-controls="isCompactOpen ? compactPanelId : undefined"
      :aria-expanded="isCompactOpen"
      @click="isCompactOpen = true"
    >
      <List aria-hidden="true" class="toc-compact-trigger__icon" />
      <span>{{ label }}</span>
      <span class="toc-compact-trigger__hint" aria-hidden="true">{{ headers.length }}</span>
    </button>
    <nav
      :id="desktopPanelId"
      class="toc-content toc-content--desktop"
      :aria-label="label"
    >
      <h3 class="toc-content__heading">{{ label }}</h3>
      <VPTableOfContentLinks :headers="headers" />
    </nav>
    <div class="toc-content-mask" />

    <ClientOnly>
      <ElDialog
        v-model="isCompactOpen"
        align-center
        append-to-body
        class="toc-compact-dialog"
        destroy-on-close
        :show-close="false"
        width="min(560px, calc(100vw - 24px))"
      >
        <template #header="{ close, titleId, titleClass }">
          <div class="toc-compact-dialog__header">
            <span :id="titleId" :class="titleClass" role="heading" aria-level="2">{{ label }}</span>
            <button
              class="toc-compact-dialog__close"
              type="button"
              :aria-label="lang.toLowerCase().startsWith('zh') ? '关闭' : 'Close'"
              @click="close"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>
        </template>
        <nav
          :id="compactPanelId"
          class="toc-compact-dialog__content"
          :aria-label="label"
          @click="closeCompactToc"
        >
          <VPTableOfContentLinks :headers="headers" />
        </nav>
      </ElDialog>
    </ClientOnly>
  </aside>
</template>
