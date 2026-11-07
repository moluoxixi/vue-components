<script setup lang="ts">
import type { Measurable } from 'element-plus'
import { ChevronDown, List } from '@lucide/vue'
import { ElPopover } from 'element-plus'
import { computed, nextTick, ref } from 'vue'
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'
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
provideDocsUi()
</script>

<template>
  <aside data-docs-ui class="toc-wrapper">
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
      <h3 class="toc-content__heading">
        {{ label }}
      </h3>
      <VPTableOfContentLinks :headers="headers" />
    </nav>
    <div class="toc-content-mask" />
  </aside>
</template>

<style scoped lang="scss">
@use '../../styles/mixins' as *;

.toc-wrapper:not(:where(.vp-raw, .vp-raw *)) {
  display: block;
  flex: none;
  margin-bottom: 24px;
  position: sticky;
  top: calc(var(--ep-docs-docs-sticky-offset) + 8px);
  width: 100%;
  z-index: 6;

  @include respond-to('xxl') {
    margin-bottom: 0;
    order: 2;
    padding-left: 40px;
    padding-right: 32px;
    position: relative;
    top: auto;
    width: auto;
    z-index: auto;
  }

  @include respond-to('max') {
    padding-left: 56px;
    padding-right: 48px;
  }

  .toc-compact-trigger {
    align-items: center;
    background: var(--ep-docs-bg-color);
    border: 1px solid var(--ep-docs-border-color-light);
    border-radius: 6px;
    box-shadow: 0 1px 2px rgba(31, 35, 41, 0.04);
    color: var(--ep-docs-text-color);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    gap: 9px;
    justify-content: flex-start;
    line-height: 20px;
    min-height: 44px;
    padding: 10px 14px;
    text-align: left;
    width: 100%;
    transition:
      background-color var(--epd-transition-duration-fast),
      border-color var(--epd-transition-duration-fast),
      color var(--epd-transition-duration-fast);

    &[aria-expanded='true'] {
      border-color: color-mix(in srgb, var(--ep-docs-brand-color) 45%, var(--ep-docs-border-color-light));
      color: var(--ep-docs-brand-color);
    }

    &:focus-visible {
      outline: 2px solid var(--ep-docs-brand-color);
      outline-offset: 2px;
    }

    &__icon {
      flex: none;
      height: 18px;
      width: 18px;
    }

    &__hint {
      display: inline-flex;
      min-width: 22px;
      height: 22px;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      padding: 0 6px;
      border-radius: 11px;
      background: var(--ep-docs-bg-color-soft);
      color: var(--ep-docs-text-color-lighter);
      font-size: 11px;
      font-weight: 500;
    }

    &__chevron {
      flex: none;
      height: 16px;
      width: 16px;
      color: var(--ep-docs-text-color-lighter);
      transition: transform 0.18s ease;
    }

    &[aria-expanded='true'] &__chevron {
      color: var(--ep-docs-brand-color);
      transform: rotate(180deg);
    }

    @include respond-to('xxl') {
      display: none;
    }
  }

  .toc-content {
    display: none;

    @include respond-to('xxl') {
      background: transparent;
      border: 0;
      border-radius: 0;
      display: block;
      height: calc(100vh - var(--ep-docs-header-height) - 32px);
      margin-bottom: 32px;
      margin-top: 0;
      max-height: none;
      overflow-y: auto;
      padding: 0 3px 30px;
      position: sticky;
      scrollbar-width: none;
      top: calc(var(--ep-docs-header-height) + 32px);
      width: 220px;
    }

    &__heading {
      color: var(--ep-docs-text-color-light);
      font-size: 12px;
      font-weight: 600;
      line-height: 30px;
      margin-bottom: 4px;
      margin-top: 0;
      padding-left: 14px;
      text-transform: uppercase;
    }

    p {
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .toc-content-mask {
    display: none;

    @include respond-to('xxl') {
      display: block;
    }

    position: absolute;
    bottom: 30px;
    height: 32px;
    width: 220px;
    z-index: 4;
    background: linear-gradient(transparent, var(--ep-docs-bg-color) 70%);
  }
}

:global(.toc-compact-popper.epd-popper) {
  width: min(560px, calc(100vw - 24px)) !important;
  max-width: calc(100vw - 24px);
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--ep-docs-border-color-light);
  border-radius: 6px;
  background: var(--ep-docs-bg-color);
  box-shadow: 0 10px 30px rgba(31, 35, 41, 0.12), 0 2px 8px rgba(31, 35, 41, 0.06);

}

:global(.toc-compact-popper.epd-popper > .epd-popover__title) {
  display: none;
}

.toc-compact-panel {
  background: var(--ep-docs-bg-color);

  &__header {
    display: flex;
    min-height: 42px;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 9px 16px;
    border-bottom: 1px solid var(--ep-docs-border-color-lighter);
    background: var(--ep-docs-bg-color-soft);
  }

  &__title {
    color: var(--ep-docs-text-color);
    font-size: 13px;
    font-weight: 600;
  }

  &__count {
    color: var(--ep-docs-text-color-lighter);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  &__content {
    max-height: min(62vh, 520px);
    padding: 10px 14px 14px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
}

:global(.dark .toc-compact-popper.epd-popper) {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);
}
</style>
