# @moluoxixi/config-form-core

ConfigForm 的零 UI 依赖共享内核。它提供可序列化 JSON、条件表达式、reaction effect 类型，以及同步稳定的纯 reaction reducer。

Core 不依赖 Vue、Zod、Headless、Runtime、Designer 或任何组件库，可单独用于配置编辑、服务端预处理、导入校验前的业务投影和测试。

Reaction 配置与执行分成两个独立模块：`reaction-config` 提供默认对象工厂和不可变编辑 helper，`reaction` 负责执行已保存的声明。设计器与其他配置编辑器可以直接复用同一份构造逻辑。

```ts
import { applyConfigFormReactionList } from '@moluoxixi/config-form-core'

const result = applyConfigFormReactionList(
  [
    {
      id: 'enable-detail',
      when: {
        kind: 'compare',
        operator: 'eq',
        left: { kind: 'field', field: 'enabled' },
        right: { kind: 'literal', value: true },
      },
      then: [
        {
          kind: 'setValue',
          target: 'status',
          value: { kind: 'literal', value: 'ready' },
        },
      ],
    },
  ],
  { enabled: true },
)
```

```ts
import type { ConfigFormReaction } from '@moluoxixi/config-form-core'
import { createConfigFormReaction, createConfigFormReactionId } from '@moluoxixi/config-form-core'

const reactions: ConfigFormReaction[] = []
const reaction = createConfigFormReaction({
  id: createConfigFormReactionId(reactions),
  target: 'detail',
})
```

联动按声明顺序同步执行，值效果会持续计算到稳定状态。非收敛值循环抛出 `CONFIG_FORM_REACTION_CYCLE`；条件树或参与克隆、比较的值超过 `CONFIG_FORM_REACTION_MAX_DEPTH` 时抛出 `CONFIG_FORM_REACTION_DEPTH_EXCEEDED`，避免公开 reducer 退化为原生调用栈错误。

表单 Controller、Vue 渲染、校验生命周期和字段节点树属于 `@moluoxixi/config-form-headless`；可视化文档、Zod schema 和编辑器属于 Designer。

## 事件运行时

`createConfigFormEventRuntime` 是公开表单、工作台预览与导出源码共用的事件执行入口。每个表单实例持有独立运行时，通过 `readValues/writeValues` 连接唯一值源，以 `sync(plans)` 更新执行计划，并在销毁时调用 `dispose()`。

动作的 `execute(input, context)` 接收 `event`、`signal`、运行身份、值快照、前序输出和 `form` API。`context.form.setValue/setValues` 只写当前运行事务，成功后提交；`getValue/getValues` 返回防御性副本。并发支持 `latest/queue/ignore`，按 Flow ID 隔离。排队任务启动时读取最新值，事件参数仍使用触发时快照。

输入引用支持 `{ $field: 'name' }`、`{ $event: 'args.0' }`、`{ $output: 'action-id' }` 和 `{ $expression: '$event.args[0]' }`。缺失的事件参数、前序输出或非法表达式会形成诊断。`snapshotConfigFormEventArgs` 将原生事件转换为受限 JSON 数据，不传递 DOM 或组件实例。

当前执行合同版本为 `CONFIG_FORM_FLOW_RUNTIME_VERSION = 2`。图协议仍为 v1，但同一出口的重复边与终止节点出边不再合法。
