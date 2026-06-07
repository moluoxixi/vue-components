# shadcn-vue本地组件协议

## 用途

本仓库没有发现直接安装的 `shadcn-vue` package；相关能力通过 `@moluoxixi/config-form-shadcn-vue` 与 `@moluoxixi/config-form-plugin-shadcn-vue` 支持调用方传入本地生成组件。插件维护组件 key 到 ConfigForm 字段绑定协议的映射。

## 来源

| 类型 | 路径 |
|---|---|
| package | `packages/ConfigForm/shadcn/package.json`、`packages/ConfigForm/plugin-shadcn-vue/package.json`、`packages/components/package.json` |
| 源码 | `packages/ConfigForm/shadcn/src/index.vue`、`packages/ConfigForm/plugin-shadcn-vue/src/index.ts`、`packages/ConfigForm/plugin-shadcn-vue/src/bindings.ts` |
| 示例 | `packages/ConfigForm/playground/src/examples/ShadcnConfigForm.vue`、`playgrounds/components-playground/src/examples/ShadcnConfigForm.vue` |
| 测试 | `packages/ConfigForm/shadcn/ShadcnConfigForm.test.ts`、`packages/ConfigForm/plugin-shadcn-vue/__tests__/shadcnVuePlugin.test.ts` |

## 使用约束

- 调用方通过 `components` 注册本地生成组件；插件不导入任何业务项目的 shadcn-vue 生成路径。
- 内置字段绑定覆盖 `Input`、`NativeSelect`、`Textarea`，默认使用 `modelValue/update:modelValue`。
- 需要扩展本地组件时，通过 `bindings` 和 `readonlyAdapters` 增补协议；不要把 ConfigForm core 改成某个 UI 库的兼容层。
- `strict` 默认开启，已注册组件缺少绑定映射时抛出 `CONFIG_FORM_SHADCN_VUE_UNKNOWN_BINDING`。

## 交互状态

- `ShadcnConfigForm` 自身负责布局、字段递归、错误展示和提交契约。
- 本地组件只承载输入 UI，字段显隐、模型写回、校验和只读策略仍由 ConfigForm runtime 管理。
- Playground 使用本地轻量控件模拟 Input、Select、Textarea、Switch、Radio、Card、Accordion 和 Tabs 等场景。

## 可访问性

本地生成组件必须提供可访问名称和键盘交互。ConfigForm 可以提供 label 与错误文本，但无法替代本地组件自身的焦点、角色和状态语义。

## 测试建议

覆盖本地组件注册、字符串组件 key 解析、未知绑定 strict 抛错、只读展示、容器节点和 playground 的 shadcn 场景提交。

## 缺口

MISSING 真实业务项目中的 shadcn-vue 生成组件目录；本仓库只包含协议适配和 playground 模拟控件。
