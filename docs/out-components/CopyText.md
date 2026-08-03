# CopyText / HeadlessCopyText

`CopyText` 提供文本展示、复制按钮和无障碍成功反馈；`HeadlessCopyText` 只管理复制命令与状态，由默认作用域插槽决定 UI。两者优先使用 Clipboard API，并在浏览器不支持或拒绝时退回 textarea copy。

## 引入

```ts
import { CopyText, HeadlessCopyText, copyText } from '@moluoxixi/components'
```

## CopyText Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `text` | `string` | 必填 | 写入剪贴板的纯文本；默认插槽只改变展示，不改变复制值。 |
| `disabled` | `boolean` | `false` | 禁止复制。 |
| `resetDelay` | `number` | `2000` | 成功状态复位毫秒数；`0` 表示不自动复位。 |
| `copyLabel` | `string` | `复制` | 默认按钮复制前的标题和无障碍名称。 |
| `copiedLabel` | `string` | `已复制` | 成功后的标题、无障碍名称和 live region 文本。 |

## CopyText 事件与插槽

| 名称 | 参数 | 说明 |
|---|---|---|
| `copy` | `(text: string)` | 复制成功后触发。 |
| `error` | `(error: Error)` | Clipboard API 和 fallback 均失败时触发。 |
| `default` | `{ text: string }` | 定制文本展示。 |
| `icon` | `HeadlessCopyTextDefaultScope` | 定制复制、处理中和成功图标。 |

## HeadlessCopyText

`HeadlessCopyText` 使用与 `CopyText` 相同的 `text`、`disabled`、`resetDelay` Props 以及 `copy`、`error` 事件。默认插槽作用域如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` | `string` | 当前复制文本。 |
| `disabled` | `boolean` | 当前禁用状态。 |
| `copying` | `boolean` | 复制命令执行中。 |
| `copied` | `boolean` | 最近一次复制成功。 |
| `error` | `Error \| null` | 最近一次复制错误。 |
| `copy` | `(text?: string) => Promise<void>` | 执行复制，可临时覆盖 Props 文本；最终失败时在发出 `error` 事件后 reject。 |
| `reset` | `() => void` | 清除成功和错误状态。 |

两个组件实例均通过 `defineExpose` 暴露 `copy` 与 `reset`。独立的 `copyText(text)` 函数执行同一套 Clipboard API 与 fallback 策略，失败时抛出 `ClipboardCopyError`。

## 示例

```vue
<CopyText text="PO-2026-0803" @copy="handleCopied">
  <template #default="{ text }">
    <code>{{ text }}</code>
  </template>
</CopyText>

<HeadlessCopyText text="HEADLESS-001">
  <template #default="{ copy, copied, copying }">
    <button :disabled="copying" @click="copy().catch(() => undefined)">
      {{ copied ? '已复制' : '复制' }}
    </button>
  </template>
</HeadlessCopyText>
```

## 可访问性与测试

- `CopyText` 使用原生按钮，并通过动态 `aria-label`、`title` 和 `role="status"` 反馈结果。
- Clipboard API 受安全上下文和浏览器权限约束；测试失败分支时应同时模拟 `navigator.clipboard.writeText` 与 `document.execCommand`。
- `HeadlessCopyText` 不生成 DOM，交互语义由插槽调用方负责。
- 直接从点击处理器调用 headless `copy()` 时，应处理 reject；组件已通过 `error` 事件同步暴露同一错误。

## 变更记录

- 2026-08-03：新增 `CopyText`、`HeadlessCopyText` 和 `copyText`。
