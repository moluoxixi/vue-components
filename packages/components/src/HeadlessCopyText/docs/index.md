# HeadlessCopyText

无头复制文本原语，提供状态与逻辑，UI 完全由默认插槽自定义。

## 基础用法

:::demo 通过默认插槽接收状态，完全自主控制渲染。
```vue
<template>
  <HeadlessCopyText text="headless-copy-example">
    <template #default="{ text, copied, copying, error, copy, reset }">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:13px;color:#606266;">{{ text }}</span>
        <ElButton
          size="small"
          :type="copied ? 'success' : 'primary'"
          :loading="copying"
          :disabled="copying"
          @click="copy()"
        >
          {{ copied ? '已复制' : '复制' }}
        </ElButton>
        <ElButton v-if="copied" size="small" @click="reset()">重置</ElButton>
        <span v-if="error" style="color:#f56c6c;font-size:12px;">失败</span>
      </div>
    </template>
  </HeadlessCopyText>
</template>
```
:::

## 带动画反馈

:::demo 利用 `copied` 状态实现自定义过渡动画。
```vue
<template>
  <HeadlessCopyText text="动画反馈示例文本">
    <template #default="{ text, copied, copy }">
      <div style="display:inline-flex;gap:8px;align-items:center;">
        <code style="background:#f5f7fa;padding:2px 8px;border-radius:4px;font-size:13px;">
          {{ text }}
        </code>
        <ElTag v-if="copied" type="success" effect="light">已复制</ElTag>
        <ElButton v-else size="small" type="primary" @click="copy()">复制</ElButton>
      </div>
    </template>
  </HeadlessCopyText>
</template>
```
:::

## API

<ApiDocs name="HeadlessCopyText" />
