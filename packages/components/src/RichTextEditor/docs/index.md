# RichTextEditor

开箱即用的富文本编辑器，支持常用格式、链接、列表、对齐及历史操作，v-model 绑定 HTML 字符串。

## 基础用法

:::demo v-model 双向绑定 HTML 字符串；工具栏包含加粗、斜体、下划线、链接、列表等常用操作。
```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/components'
import { ref } from 'vue'

const content = ref('<p>在这里输入内容……</p>')
</script>
<template>
  <RichTextEditor v-model="content" placeholder="请输入内容" />
  <div style="margin-top:12px;font-size:12px;color:#999;">
    HTML 输出：{{ content.slice(0, 80) }}…
  </div>
</template>
```
:::

## 禁用与只读

:::demo 通过 `disabled` 和 `readonly` 控制可编辑状态。
```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/components'
import { ElSwitch } from 'element-plus'
import { ref } from 'vue'

const content = ref('<h2>季度发布说明</h2><p>本次版本包含 <strong>批量处理</strong> 与权限审计增强。</p>')
const disabled = ref(false)
const readonly = ref(false)
</script>
<template>
  <div style="display:flex;gap:20px;margin-bottom:12px;">
    <label style="display:inline-flex;align-items:center;gap:8px;">
      禁用 <ElSwitch v-model="disabled" />
    </label>
    <label style="display:inline-flex;align-items:center;gap:8px;">
      只读 <ElSwitch v-model="readonly" />
    </label>
  </div>
  <RichTextEditor
    v-model="content"
    :disabled="disabled"
    :readonly="readonly"
    :max-height="300"
    min-height="160px"
  />
</template>
```
:::
