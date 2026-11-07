# HeadlessCopyText

无头复制文本原语，提供状态与逻辑，UI 完全由默认插槽自定义。

## 基础用法

:::demo 通过默认插槽接收状态，完全自主控制渲染。

```vue
<script setup lang="ts">
import { HeadlessCopyText } from '@moluoxixi/components'
import { ElButton, ElTooltip } from 'element-plus'
</script>

<template>
  <HeadlessCopyText text="headless-copy-example">
    <template #default="{ text, copied, copying, error, copy, reset }">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:13px;color:#606266;">{{ text }}</span>
        <ElTooltip :disabled="!copying" content="正在复制，请等待完成后重试。">
          <span>
            <ElButton
              size="small"
              :type="copied ? 'success' : 'primary'"
              :loading="copying"
              :disabled="copying"
              @click="copy().catch(() => undefined)"
            >
              {{ copied ? '已复制' : '复制' }}
            </ElButton>
          </span>
        </ElTooltip>
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
<script setup lang="ts">
import { HeadlessCopyText } from '@moluoxixi/components'
import { ElButton, ElTag } from 'element-plus'
</script>

<template>
  <HeadlessCopyText text="动画反馈示例文本">
    <template #default="{ text, copied, copy }">
      <div style="display:inline-flex;gap:8px;align-items:center;">
        <code style="background:#f5f7fa;padding:2px 8px;border-radius:4px;font-size:13px;">
          {{ text }}
        </code>
        <ElTag v-if="copied" type="success" effect="light">已复制</ElTag>
        <ElButton v-else size="small" type="primary" @click="copy().catch(() => undefined)">复制</ElButton>
      </div>
    </template>
  </HeadlessCopyText>
</template>
```

:::

## 插槽与调用契约

| 字段                 | 说明                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `text` / `disabled`  | 当前输入文本与禁用状态。                                                 |
| `copying` / `copied` | 正在复制与复制成功状态；可用于 loading、按钮文字和反馈。                 |
| `error`              | 最近一次复制失败的 Error，正常时为 null。                                |
| `copy(text?)`        | 默认复制 props.text，也可临时传入其他文本；返回 Promise，失败时 reject。 |
| `reset()`            | 清理成功/失败反馈，不写剪贴板，也不改变 text。                           |

组件不创建默认按钮。`text` 必填；`disabled` 默认 false；`resetDelay` 默认 2000ms，0 表示不自动清除成功状态。成功触发 `copy(text)` 事件，失败触发 `error(Error)`；组件 ref 也提供 copy/reset 方法。

## 可访问性与失败处理

点击处理器应使用 `copy().catch(...)`，并通过 slot.error 或 `@error` 显示失败原因。用 `aria-live="polite"` 宣读结果。业务禁用和正在复制时，应在可接收悬停事件的外层元素展示原因 tooltip；不能仅依赖 disabled 按钮本身接收事件。

复制需要浏览器权限和用户操作。此组件提供状态与命令，不承诺绕过浏览器权限或在 SSR 期间写入剪贴板。
