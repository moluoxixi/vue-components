# ConfigForm

`src` 目录是 `@moluoxixi/config-form` 的源码实现。完整使用文档见包根目录的 `README.md`。

## 核心约定

- 字段通过 `defineField({ field, component, schema, ... })` 或普通 config 创建；需要绑定业务模型时使用 `defineField<TValues>({ field, component, schema, ... })`。
- `defineField` 返回普通配置对象，不写入 symbol、隐藏属性或 defineProperty 标记；字段默认值、组件解析和插件转换统一由 `ConfigForm` 根组件的 runtime 管线完成。
- 表单值通过 `modelValue` / `v-model` 同步。
- 默认值来自字段 `defaultValue`，外部 `modelValue` 会覆盖默认值。
- `validator(value, values)` 可用于跨字段或异步校验。
- 非标准组件事件通过 `getValueFromEvent(...args)` 显式提取字段值，默认只取第一个事件参数。
- 隐藏和禁用字段默认不进入 submit 输出，可用 `submitWhenHidden` / `submitWhenDisabled` 开启。
- `slots` 与顶层 `fields` 使用同一声明模式，只接收普通对象配置或 `defineField(...)` 创建的容器组件节点/真实字段节点数组；无 `field` 的节点只渲染组件本体，有 `field` 的节点才绑定表单值和校验。
- `slots` 不接收文本、VNode 或渲染函数；需要文本内容时用普通子节点配置承载文本 props。
- runtime 对组件和插件名注册冲突一律抛错，不提供覆盖或静默降级策略；插件只通过 `transformField(field)` 转换字段。
- 内置默认值插件位于 `src/plugins/builtInFieldDefaults.ts`，`resolveField(field)` 只返回默认配置片段；runtime transform 指字段配置转换管线，不是提交值转换函数。

## 样式命名空间

默认类名前缀是 `cf`。如果运行时传入 `namespace`，业务侧引入 SCSS 时也需要使用相同 `$namespace`。
