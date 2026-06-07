# EnterNextContainer组件文档

## 用途

`EnterNextContainer` 用于在表单区域内监听 `input`、`select`、`textarea` 的 Enter 键，并将焦点移动到下一个可用控件。组件来源为 `packages/components/src/EnterNextContainer`。

## 引入

```ts
import { EnterNextContainer } from '@moluoxixi/components'
import type { EnterNextContainerProps } from '@moluoxixi/components'
```

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| virtualRef | `ComponentPublicInstance \| ComponentInternalInstance \| HTMLElement \| null` | `null` | 否 | 外部容器引用；未提供时监听默认插槽容器。 |
| allowSelectNextInEmpty | `boolean` | `false` | 否 | 下拉控件展开但无高亮选项时，是否仍允许跳到下一个输入控件。 |
| focusNum | `number` | `undefined` | 否 | 挂载后默认聚焦的控件序号，沿用一基序号。 |
| autoNext | `boolean` | `true` | 否 | 是否只在可用控件集合里计算默认聚焦位置。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| noNextInput | 当前控件已经是最后一个可用控件时触发，参数为当前 `HTMLElement`。 |
| noSelectValue | 下拉控件展开但未选中活动项时触发，参数为当前 `HTMLElement`。 |

## 插槽或 Children

| 名称 | 说明 |
|---|---|
| default | 承载需要监听的表单区域；仅在未传 `virtualRef` 时由组件自身渲染容器。 |

## 状态

- 组件挂载后收集可用输入控件，并用 `MutationObserver` 监听 DOM 变化。
- disabled 控件会被排除在 Enter 跳转序列外。
- `aria-expanded="true"` 且无 `aria-activedescendant` 的控件默认阻止自动跳转。
- `virtualRef` 无法解析为 DOM 元素时抛出明确错误。

## 可访问性

组件只调整焦点顺序，不替代表单控件自身的 label、role 和错误提示。下拉控件通过 `aria-expanded` 与 `aria-activedescendant` 判断是否等待用户选择。

## 示例

```vue
<EnterNextContainer
  :focus-num="1"
  @no-next-input="handleNoNextInput"
  @no-select-value="handleNoSelectValue"
>
  <ElInput v-model="formModel.customerName" />
  <ElInput v-model="formModel.contact" />
  <ElSelect v-model="formModel.level" />
</EnterNextContainer>
```

## 测试建议

覆盖 Enter 焦点跳转、末尾 `noNextInput`、空下拉 `noSelectValue`、`virtualRef` 切换和 DOM 动态变化后的监听刷新。

## 变更记录

- 2026-06-07：根据源码、类型和测试生成组件契约文档。
