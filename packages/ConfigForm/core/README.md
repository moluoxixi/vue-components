# @moluoxixi/config-form-core

ConfigForm 的零 UI 依赖共享内核。它提供可序列化 JSON、条件表达式、reaction effect 类型，以及同步稳定的纯 reaction reducer。

Core 不依赖 Vue、Zod、Headless、Runtime、Designer 或任何组件库，可单独用于配置编辑、服务端预处理、导入校验前的业务投影和测试。

Reaction 配置与执行分成两个独立模块：`reaction-config` 提供默认对象工厂和不可变编辑 helper，`reaction` 负责执行已保存的声明。设计器与其他配置编辑器可以直接复用同一份构造逻辑。

```ts
import { applyConfigFormReactionList } from '@moluoxixi/config-form-core'

const result = applyConfigFormReactionList([{
  id: 'enable-detail',
  when: {
    kind: 'compare',
    operator: 'eq',
    left: { kind: 'field', field: 'enabled' },
    right: { kind: 'literal', value: true },
  },
  then: [{
    kind: 'setValue',
    target: 'status',
    value: { kind: 'literal', value: 'ready' },
  }],
}], { enabled: true })
```

```ts
import {
  createConfigFormReaction,
  createConfigFormReactionId,
} from '@moluoxixi/config-form-core'

const reactions = []
const reaction = createConfigFormReaction({
  id: createConfigFormReactionId(reactions),
  target: 'detail',
})
```

联动按声明顺序同步执行，值效果会持续计算到稳定状态。非收敛值循环抛出 `CONFIG_FORM_REACTION_CYCLE`；条件树或参与克隆、比较的值超过 `CONFIG_FORM_REACTION_MAX_DEPTH` 时抛出 `CONFIG_FORM_REACTION_DEPTH_EXCEEDED`，避免公开 reducer 退化为原生调用栈错误。

表单 Controller、Vue 渲染、校验生命周期和字段节点树属于 `@moluoxixi/config-form-headless`；可视化文档、Zod schema 和编辑器属于 Designer。
