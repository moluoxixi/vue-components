# EnterNextContainer

回车 / 方向键智能跳转容器，按下 Enter 自动聚焦下一个输入控件，适用于快速录入场景。

## 基础用法

:::demo 将输入控件放入容器，按 Enter 键自动跳到下一个。

```vue
<script setup lang="ts">
import { EnterNextContainer } from '@moluoxixi/components'
import { ElInput } from 'element-plus'
</script>

<template>
  <EnterNextContainer>
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <ElInput placeholder="姓名（回车跳下一项）" />
      <ElInput placeholder="手机号" />
      <ElInput placeholder="邮箱" />
      <ElInput placeholder="备注" type="textarea" :rows="2" />
    </div>
  </EnterNextContainer>
</template>
```

:::

## 初始聚焦

:::demo 通过 `focusNum` 指定挂载后默认聚焦的控件序号（从 1 开始）。

```vue
<script setup lang="ts">
import { EnterNextContainer } from '@moluoxixi/components'
import { ElInput } from 'element-plus'
</script>

<template>
  <EnterNextContainer :focus-num="2">
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <ElInput placeholder="第1项" />
      <ElInput placeholder="第2项（默认聚焦）" />
      <ElInput placeholder="第3项" />
    </div>
  </EnterNextContainer>
</template>
```

:::

## 焦点与事件契约

| 接口                     | 说明                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| 默认插槽                 | 包裹需要连续录入的表单区域。                                                      |
| `virtualRef`             | 可选外部 DOM / Vue 组件引用；传入时改为观察该容器。                               |
| `focusNum`               | 初始聚焦位置，从 1 开始；省略时不主动抢焦点。                                     |
| `autoNext`               | 默认 true，初始焦点位置只在未禁用控件中计算；false 时按全部候选控件计算初始位置。 |
| `allowSelectNextInEmpty` | 默认 false，展开的下拉框没有活动选项时暂停跳转；设为 true 才继续。                |
| `noNextInput(element)`   | 当前是最后一个可用输入控件，交由业务决定提交、提示或添加下一行。                  |
| `noSelectValue(element)` | 下拉框展开但没有活动选项，需要先完成选择。                                        |

监听容器中的 input/select/textarea，按 DOM 顺序在 Enter keyup 后切换焦点。通过 MutationObserver 更新动态控件集合；切换 virtualRef 和卸载时会清理监听。它不会自动提交表单，也不提供表单校验。

## 接入注意

将组件放在有限的录入区域，避免包裹整个页面。禁用控件不会参与正常跳转；隐藏或只读控件的业务顺序请在页面层核对。textarea 也属于候选输入，若 Enter 需要保留换行，请将该区域移出容器。下拉框的键盘语义依赖其 aria-expanded / aria-activedescendant，适配其他组件库时需要实测。
