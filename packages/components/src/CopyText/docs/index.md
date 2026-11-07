# CopyText

带状态反馈的复制文本组件，封装剪贴板写入逻辑，提供加载、已复制、出错三种视觉状态。

## 基础用法

:::demo 将 `text` 属性设置为要复制的文本。

```vue
<script setup lang="ts">
import { CopyText } from '@moluoxixi/components'
</script>

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
<script setup lang="ts">
import { CopyText } from '@moluoxixi/components'
</script>

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
<script setup lang="ts">
import { CopyText } from '@moluoxixi/components'
</script>

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
<script setup lang="ts">
import { CopyText } from '@moluoxixi/components'
import { ElTooltip } from 'element-plus'
</script>

<template>
  <div style="display:flex;gap:16px;">
    <CopyText text="正常状态" />
    <ElTooltip content="当前示例禁止复制，切换到正常状态后可复制。">
      <span>
        <CopyText text="禁用状态" :disabled="true" />
      </span>
    </ElTooltip>
  </div>
</template>
```

:::

## 状态、事件与方法

| 接口                           | 行为                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `text`                         | 必填，实际写入剪贴板的纯文本；修改默认插槽不会改变复制内容。                  |
| `disabled`                     | 默认 false，禁止复制；业务禁用时用外层 tooltip 说明原因及恢复条件。           |
| `resetDelay`                   | 默认 2000ms；设为 0 后保留成功状态，直到下一次命令或手动 reset。              |
| `copyLabel` / `copiedLabel`    | 默认“复制”/“已复制”，用于可访问名称和按钮提示。                               |
| `copy` / `error` 事件          | 复制成功返回文本，失败返回 Error。                                            |
| `copy(text?)` / `reset()` 方法 | ref 可调用；copy 返回 Promise，失败需 catch；reset 清理反馈，不修改业务文本。 |
| 默认插槽 / `icon` 插槽         | 默认插槽接收 text；icon 接收 copied、copying、error、copy、reset 等完整状态。 |

## 错误处理与使用边界

浏览器剪贴板能力受安全上下文、权限和用户操作影响；不要在 mounted 中自动调用复制。普通按钮点击已处理 Promise 拒绝并触发 error，应用可通过 `@error` 显示业务提示；通过 ref 调用时仍需捕获异常。空字符串也是合法复制内容。

自定义图标应保留按钮的可访问名称。若复制尚未完成，请显示“正在复制，请稍候”并避免重复提交。默认视觉不适合业务布局时，可使用 HeadlessCopyText 自行组合状态与交互。
