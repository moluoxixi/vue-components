<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '../../../../markdown'

const props = defineProps<{ source: string }>()
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <!-- html 只能来自禁用原生 HTML 且限制 URL scheme 的 markdown renderer。 -->
  <div class="markdown-content" data-testid="answer-text" v-html="html" />
</template>

<style scoped>
.markdown-content {
  min-width: 0;
  color: #303133;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.72;
}

.markdown-content :deep(> :first-child) { margin-top: 0; }
.markdown-content :deep(> :last-child) { margin-bottom: 0; }
.markdown-content :deep(p),
.markdown-content :deep(ul),
.markdown-content :deep(ol),
.markdown-content :deep(blockquote),
.markdown-content :deep(pre) { margin: 0 0 12px; }
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin: 20px 0 10px;
  color: #1f2328;
  line-height: 1.35;
  letter-spacing: 0;
}
.markdown-content :deep(h1) { font-size: 20px; }
.markdown-content :deep(h2) { font-size: 17px; }
.markdown-content :deep(h3),
.markdown-content :deep(h4) { font-size: 15px; }
.markdown-content :deep(ul),
.markdown-content :deep(ol) { padding-left: 22px; }
.markdown-content :deep(blockquote) {
  padding-left: 12px;
  border-left: 3px solid #c7d2e0;
  color: #59636e;
}
.markdown-content :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #eef1f5;
  color: #9b2c2c;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}
.markdown-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: 14px;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: #161b22;
  color: #d7dde5;
}
.markdown-content :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}
.markdown-content :deep(a) { color: #0969da; text-underline-offset: 3px; }
.markdown-content :deep(a:focus-visible) { outline: 2px solid #409eff; outline-offset: 2px; }
</style>
