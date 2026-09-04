<script setup lang="ts">
import type { WorkspaceCodeEditorEmits, WorkspaceCodeEditorProps } from './types'
import { useWorkspaceCodeEditor } from './composables'

const props = withDefaults(defineProps<WorkspaceCodeEditorProps>(), {
  language: 'plaintext',
  readonly: false,
  theme: 'dark',
})
const emit = defineEmits<WorkspaceCodeEditorEmits>()
const { containerRef, cursorColumn, cursorLine, languageLabel, locale } = useWorkspaceCodeEditor(props, emit)
</script>
<template>
  <div class="workspace-code-editor-shell" :data-theme="theme" role="region" :aria-label="locale.t('editor.codeViewer', 'Code viewer')" :aria-readonly="readonly">
    <div ref="container" class="workspace-code-editor" />
    <footer class="workspace-code-editor-status" :aria-label="locale.t('editor.status', 'Editor status')">
      <span>{{ locale.t('editor.lineColumn', 'Ln {line}, Col {column}', { line: cursorLine, column: cursorColumn }) }}</span>
      <span>{{ locale.t('editor.spaces', 'Spaces: {count}', { count: 2 }) }}</span>
      <span>UTF-8</span>
      <span>{{ languageLabel }}</span>
    </footer>
  </div>
</template>

<style scoped>
.workspace-code-editor-shell {
  --editor-shell-bg: #1e1e1e;
  --editor-status-bg: #181d23;
  --editor-status-border: #30363d;
  --editor-status-text: #c9d1d9;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) 23px;
  overflow: hidden;
  background: var(--editor-shell-bg);
}

.workspace-code-editor-shell[data-theme="light"] {
  --editor-shell-bg: #fff;
  --editor-status-bg: #f6f8fa;
  --editor-status-border: #d0d7de;
  --editor-status-text: #57606a;
}

.workspace-code-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--editor-shell-bg);
}

.workspace-code-editor-status {
  display: flex;
  min-width: 0;
  height: 23px;
  padding: 0 9px;
  align-items: center;
  justify-content: flex-end;
  gap: 15px;
  color: var(--editor-status-text);
  border-top: 1px solid var(--editor-status-border);
  background: var(--editor-status-bg);
  font-size: 11px;
  line-height: 23px;
  white-space: nowrap;
}
</style>
