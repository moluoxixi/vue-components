<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/components'
import { shallowRef } from 'vue'

const content = shallowRef([
  '<h2>季度发布说明</h2>',
  '<p>本次版本包含 <strong>批量处理</strong> 与权限审计增强。</p>',
  '<ul><li><p>统一操作入口</p></li><li><p>优化异常反馈</p></li></ul>',
].join(''))
const disabled = shallowRef(false)
const readonly = shallowRef(false)
</script>

<template>
  <div class="rich-text-example" data-testid="rich-text-example">
    <div class="rich-text-example__settings">
      <label>
        <span>禁用</span>
        <ElSwitch v-model="disabled" aria-label="禁用富文本编辑器" />
      </label>
      <label>
        <span>只读</span>
        <ElSwitch v-model="readonly" aria-label="只读富文本编辑器" />
      </label>
    </div>

    <RichTextEditor
      v-model="content"
      :disabled="disabled"
      :readonly="readonly"
      :max-height="360"
      min-height="220px"
      placeholder="填写发布说明"
      aria-label="发布说明"
    />

    <div class="rich-text-example__output">
      <div class="rich-text-example__output-label">HTML</div>
      <pre data-testid="rich-text-html">{{ content }}</pre>
    </div>
  </div>
</template>

<style scoped>
.rich-text-example {
  max-width: 900px;
}

.rich-text-example__settings {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.rich-text-example__settings label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.rich-text-example__output {
  margin-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

.rich-text-example__output-label {
  margin: 12px 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
}

.rich-text-example__output pre {
  max-height: 160px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  border-radius: 4px;
  background: #172033;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
