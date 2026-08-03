# CopyText

带状态反馈的复制文本组件，封装剪贴板写入逻辑，提供加载、已复制、出错三种视觉状态。

## 基础用法

:::demo 将 `text` 属性设置为要复制的文本。
```vue
<template>
  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
    <CopyText text="Hello, World!" />
    <CopyText text="npm install @moluoxixi/components" />
    <CopyText text="一段较长的中文文本内容" />
  </div>
</template>
```
:::

## 自定义展示内容

:::demo 通过默认插槽自定义文本区域的展示。
```vue
<template>
  <CopyText text="token-abc-123456-xyz">
    <template #default="{ text }">
      <code
        style="
          background:var(--el-fill-color-light,#f5f7fa);
          padding:2px 8px;
          border-radius:4px;
          font-size:13px;
        "
      >
        {{ text }}
      </code>
    </template>
  </CopyText>
</template>
```
:::

## 自定义图标

:::demo 通过 `icon` 插槽替换按钮图标，slot scope 包含 `copied` / `copying` / `error` 状态。
```vue
<template>
  <CopyText text="自定义图标示例">
    <template #icon="{ copied }">
      <span style="font-size:13px;padding:0 4px;">
        {{ copied ? '✓' : '⧉' }}
      </span>
    </template>
  </CopyText>
</template>
```
:::

## 禁用状态

:::demo 设置 `disabled` 禁用复制功能。
```vue
<template>
  <div style="display:flex;gap:16px;">
    <CopyText text="正常状态" />
    <CopyText text="禁用状态" :disabled="true" />
  </div>
</template>
```
:::

## API

<ApiDocs name="CopyText" />
