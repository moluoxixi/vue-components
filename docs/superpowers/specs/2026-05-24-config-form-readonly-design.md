# ConfigForm Readonly Design

## 背景

当前 ConfigForm 只有 `disabled` 这一层字段级禁用语义，真实组件会收到绑定
值、事件监听和 `disabled` 透传，但没有单独的“阅读态”渲染层。这样会把
展示态和编辑态绑在一起，也会逼迫组件本身去理解 `readonly`，不符合当前
组件职责边界。

本设计要补一层独立的 readonly 管线：

- `readonly` 与 `disabled` 同层，都是字段级状态。
- readonly 不污染真实组件 props。
- 未注册的 readonly 默认直接按 `values[field.field]` 渲染文本。
- `Element Plus` 和 `Ant Design Vue` 需要分别补齐适配器，尤其是
  颜色、checkbox、radio 这类“编辑值”和“展示值”不一致的组件。

## 目标

- 新增字段级 `readonly` 语义，和 `disabled` 同层。
- readonly 命中时，切换到独立的只读渲染分支，不再走 editable component。
- 提供平面的 `readonlyAdapters` 注册表，按组件 key 注册只读展示逻辑。
- 默认未注册时，直接展示字段值本身。
- 补齐核心默认适配和 `@moluoxixi/config-form-plugin-antd-vue` 的适配器。
- 支持 select / radio / checkbox / color / switch 等组件的只读展示映射。

## 非目标

- 不把 `readonly` 做成组件 prop 透传。
- 不让 readonly 参与字段编辑事件绑定。
- 不把 readonly 设计成一个新的表单提交语义；readonly 仍然提交值。
- 不为匿名、未注册组件做复杂推断；未命中时回退到默认文本展示。

## 推荐方案

采用“字段状态 + 只读适配器”的双层设计。

1. 字段状态层
   - `FieldConfig` 新增 `readonly?: FieldCondition<FormValues>`。
   - `useFormContext()` 新增 `isReadonly(...)`。
   - `RecursiveField` 先判断 readonly，命中后走只读渲染分支。

2. 展示适配层
   - `readonlyAdapters` 是一个平面对象：`Record<string, ReadonlyAdapter>`。
   - key 使用组件注册名，比如 `ElSelect`、`ARadioGroup`。
   - 未注册时使用内置默认适配器，直接渲染 `values[field.field]`。

3. 平台适配层
   - 核心包只提供 readonly 的通用管线和默认 raw value 回退，不做组件适配。
   - `@moluoxixi/config-form-plugin-element-plus` 提供 Element Plus 只读适配器。
   - `@moluoxixi/config-form-plugin-antd-vue` 提供 Ant Design Vue 只读适配器。
   - 三者都走同一套 `ReadonlyAdapter` 类型和查找规则。

## 配置形状

```ts
export type ReadonlyAdapter = (ctx: ReadonlyRenderContext) => VNodeChild

export interface ReadonlyRenderContext {
  values: FormValues
  value: unknown
  field: string
  node: ResolvedBoundNode
}

export interface FormRuntimeOptions {
  components?: ComponentRegistry
  readonlyAdapters?: Record<string, ReadonlyAdapter>
  plugins?: FormRuntimePlugin[]
}

export interface FormRuntimePlugin {
  name: string
  components?: ComponentRegistry
  readonlyAdapters?: Record<string, ReadonlyAdapter>
  getDefaultField?: FormFieldDefault
  transformField?: FormFieldTransform
}
```

## 查找规则

- 先取 runtime / plugin 注册的 `readonlyAdapters[componentKey]`。
- 再走内置默认 raw value 适配器。
- 再不命中就回退到 raw value 文本展示。

组件 key 以 runtime 已知注册名为准。直接传 component object 的字段，如果没
有稳定 name，就不做额外推断，直接回退默认展示。

## 只读渲染行为

- readonly 只影响渲染分支，不污染 editable component。
- readonly 字段不绑定输入事件，也不透传 `disabled` 以外的编辑态 props。
- readonly 字段不执行校验；验证流程会跳过它并清理其错误。
- readonly 字段仍然参与 submit，提交值就是当前表单值。
- `disabled` 仍保留原语义；readonly 命中时优先进入只读渲染分支。
- validate / submit 中，readonly 优先于 disabled；readonly 命中时不再按
  disabled 语义跳过字段。

## 默认展示规则

默认适配器只做最小展示，不做组件级格式化：

- 普通输入类组件：直接显示 `values[field.field]`。
- 颜色类组件：如果有专用适配器，展示颜色块 + 值文本；否则回退 raw value。
- checkbox / radio 类组件：优先把当前值映射回 option label，再展示 label。
- 多选 / group 类组件：把选中项 label 用 `、` 连接。
- switch 类组件：优先展示 on/off 文本或 label；没有可用标签时回退 raw value。

只要组件没有专用 adapter，就保持最小展示，不制造额外业务假设。

## Element Plus 插件

新增 `@moluoxixi/config-form-plugin-element-plus`，专门提供 Element Plus
只读适配器。

- `ElInput` / `ElInputNumber`
- `ElSelectV2` / `ElAutocomplete` / `ElTreeSelect` / `ElCascader`
- `ElRadio` / `ElRadioGroup`
- `ElCheckbox` / `ElCheckboxGroup`
- `ElSwitch`
- `ElRate`
- `ElDatePicker` / `ElTimePicker` / `ElTimeSelect`
- `ElColorPicker`

其中：

- `select` / `tree select` / `cascader` 需要从 `props.options`、`props.data`、
  `props.props` 或对应选项结构里回查 label。
- `radio` / `checkbox group` 需要把当前值映射为 option label。
- `color` 需要展示颜色值本身，并保留可见色块。
- `switch` 需要优先使用已声明的开关文案，不能只显示布尔值。

## Ant Design Vue 适配

`@moluoxixi/config-form-plugin-antd-vue` 补齐以下 readonly 适配：

- `AInput` / `AInputNumber` / `AInputPassword` / `AInputSearch` / `ATextarea`
- `ASelect` / `AAutoComplete` / `ACascader` / `ATreeSelect`
- `ARadioGroup`
- `ACheckbox` / `ACheckboxGroup`
- `ASwitch`
- `ARate`
- `ASlider`
- `ADatePicker` / `ARangePicker` / `ATimePicker` / `ATimeRangePicker`

其中：

- `ACheckbox` / `ACheckboxGroup` / `ARadioGroup` 需要优先显示 label。
- `ASwitch` 需要优先显示显隐态文案或语义文本。
- 颜色类组件如果后续加入 AntD 适配，也走同样的 `readonlyAdapters` 机制。

## 组件边界

只读态的展示组件只负责：

- 布局
- label
- value 展示
- 必要时的颜色块 / 标签 / 选项文本映射

它们不负责：

- 编辑事件
- 输入校验
- 组件内部 disabled / readonly prop 约定

也就是说，readonly 是表单层语义，不是组件层协议。

## 错误处理

- `readonlyAdapters` 的 key 冲突按当前组件注册规则处理，不允许静默覆盖。
- 未注册 readonly 直接走默认文本展示，不抛错。
- 适配器内部如果抛错，必须让错误显式冒泡，不做降级回退。

## 测试计划

核心包测试：

- `readonly` 字段状态会进入只读渲染分支。
- 未注册 readonly 时使用 raw value 展示。
- readonly 不执行校验，但仍参与 submit。
- 未注册组件时的默认展示规则正确。

Element Plus 插件测试：

- `readonlyAdapters` 被正确合并进 runtime。
- `ElInput` / `ElSelectV2` / `ElCheckboxGroup` / `ElRadioGroup`
  / `ElSwitch` / `ElColorPicker` 的只读展示符合预期。
- 用户自定义 readonly adapter 可以覆盖插件默认值。

Antd 插件测试：

- `readonlyAdapters` 被正确合并进 runtime。
- `AInput` / `ASelect` / `ACheckboxGroup` / `ARadioGroup` / `ASwitch`
  的只读展示符合预期。
- 用户自定义 readonly adapter 可以覆盖插件默认值。

Playground 验证：

- Element Plus playground 能看到 readonly 展示。
- Antd playground 能看到对应 readonly 展示。
- 颜色、checkbox、radio 的展示不是简单 raw value。

## 实施顺序

1. 在核心包加 `readonly` 字段语义和 `readonlyAdapters` 类型。
2. 实现核心默认 readonly 渲染分支和 raw value 回退。
3. 新增 Element Plus readonly 插件包并补适配器。
4. 给 Antd 插件补 readonly adapters。
5. 补单测和 playground 示例。
6. 再补文档示例。

## 验收标准

- `readonly` 与 `disabled` 是并列字段状态。
- readonly 不污染组件 props。
- 未注册 readonly 可以直接显示 `values[field.field]`。
- Element Plus 和 AntD 的 color / checkbox / radio 展示不是 raw value。
- 运行时、插件、测试和 playground 都能一致工作。
