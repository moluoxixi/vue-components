<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useLang } from '../../composables/lang'
import { useToc } from '../../composables/use-toc'

const headers = useToc()
const lang = useLang()
const isCompactOpen = ref(false)
const compactPanelId = 'toc-compact-panel'
const label = computed(() => lang.value.toLowerCase().startsWith('zh') ? '本页目录' : 'On this page')
const removeTag = (str: string) => str.replace(/<span.*<\/span>/g, '')

function closeCompactToc() {
  isCompactOpen.value = false
}
</script>

<template>
  <aside ref="container" class="toc-wrapper">
    <button
      class="toc-compact-trigger"
      type="button"
      :aria-controls="compactPanelId"
      :aria-expanded="isCompactOpen"
      @click="isCompactOpen = !isCompactOpen"
    >
      <span>{{ label }}</span>
      <ChevronDown aria-hidden="true" class="toc-compact-trigger__icon" />
    </button>
    <nav
      :id="compactPanelId"
      class="toc-content"
      :class="{ 'is-compact-open': isCompactOpen }"
      :aria-label="label"
      @click="closeCompactToc"
    >
      <h3 class="toc-content__heading">{{ label }}</h3>
      <el-anchor :offset="70" :bound="120">
        <el-anchor-link
          v-for="{ link, text, children } in headers"
          :key="link"
          :href="link"
          :title="text"
        >
          <div :title="removeTag(text)" v-html="text" />
          <template v-if="children" #sub-link>
            <el-anchor-link
              v-for="{ link: childLink, text: childText } in children"
              :key="childLink"
              :href="childLink"
              :title="childText"
            >
              <div :title="removeTag(childText)" v-html="childText" />
            </el-anchor-link>
          </template>
        </el-anchor-link>
      </el-anchor>
    </nav>
    <div class="toc-content-mask" />
  </aside>
</template>

<style scoped lang="scss">
:deep(.el-anchor__link),
:deep(.el-anchor__link > div) {
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}
</style>
