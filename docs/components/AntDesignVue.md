# Ant Design Vue消费约束

## 用途

本仓库通过 `ant-design-vue` 支撑 Antd 版 ConfigForm、运行时字段绑定适配和 playground 示例。当前 catalog 版本范围为 `^4.2.6`，相关包 peer 范围为 `^4.2.0`。

## 来源

| 类型 | 路径 |
|---|---|
| package | `packages/ConfigForm/antd/package.json`、`packages/ConfigForm/plugin-antd-vue/package.json`、`packages/components/package.json`、`packages/ConfigForm/playground/package.json`、`playgrounds/components-playground/package.json` |
| 源码 | `packages/ConfigForm/antd/src/index.vue`、`packages/ConfigForm/antd/src/components/*`、`packages/ConfigForm/plugin-antd-vue/src/index.ts` |
| 示例 | `packages/ConfigForm/playground/src/examples/AntdConfigForm.vue`、`playgrounds/components-playground/src/examples/AntdConfigForm.vue` |
| 测试 | `packages/ConfigForm/antd/AntdConfigForm.test.ts`、`packages/ConfigForm/plugin-antd-vue/__tests__/antdVuePlugin.test.ts` |

## 使用约束

- `packages/ConfigForm/antd` 可以使用 Ant Design Vue `Form`、`Row`、`Col`、`FormItem` 承载 Antd 版渲染，但 ConfigForm 的 `values`、`fields`、`submit`、`validate` 和错误透出仍由 ConfigForm 契约定义。
- `packages/ConfigForm/plugin-antd-vue` 不直接引入 Ant Design Vue 组件，只按组件名解析并提供 `valueProp`、`trigger`、只读适配器等 runtime 默认值。
- 字段显式声明的绑定协议优先于插件默认值；`strict` 模式下形如 Ant Design Vue 组件但没有映射的字段会抛出错误。
- 本项目文档只记录本仓库使用约束，不复制 Ant Design Vue 完整 Props、Events 或 Slots API。

## 交互状态

- Antd 版 ConfigForm 通过字段级 `rules` 与顶层 `rules` 合并后交给 Ant Design Vue Form 校验。
- `Switch`、`Checkbox`、`CheckboxGroup`、`RadioGroup` 等非默认值协议组件由插件映射。
- 只读态通过 `readonlyAdapters` 展示值，核心不把只读语义反向写入第三方组件 props。

## 可访问性

字段可访问名称、必填和错误提示由 Ant Design Vue FormItem 承载。调用方必须为字段提供稳定 `label`；无 label 的容器节点必须由真实内容或自定义组件提供可访问名称。

## 测试建议

覆盖 Antd Form 校验失败、字段写回、特殊 `valueProp/trigger` 映射、只读展示、未知绑定 strict 抛错，以及 playground 中 Antd 场景的提交和重置。

## 缺口

MISSING 官方文档链接归档；本次初始化只基于本仓库 package、源码、README、测试和 lockfile 事实生成。
