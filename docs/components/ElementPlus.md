# Element Plus消费约束

## 用途

本仓库通过 `element-plus` 支撑 Element 版 ConfigForm、`DateRangePicker`、`PopoverTableSelect`、playground 框架组件和 Element Plus Resolver 自动导入。当前 catalog 版本范围为 `^2.9.1`，lockfile 解析版本为 `2.13.7`。

## 来源

| 类型 | 路径 |
|---|---|
| package | `packages/ConfigForm/element/package.json`、`packages/ConfigForm/plugin-element-plus/package.json`、`packages/components/package.json`、`packages/ConfigForm/playground/package.json`、`playgrounds/components-playground/package.json` |
| 源码 | `packages/ConfigForm/element/src/index.vue`、`packages/components/src/DateRangePicker`、`packages/components/src/PopoverTableSelect`、`packages/ConfigForm/plugin-element-plus/src/index.ts` |
| 自动导入 | `packages/ConfigForm/playground/vite.config.ts`、`playgrounds/components-playground/vite.config.ts` |
| 示例 | `packages/ConfigForm/playground/src/examples/ElementConfigForm.vue`、`playgrounds/components-playground/src/examples/ElementConfigForm.vue` |

## 使用约束

- `packages/ConfigForm/element` 可以使用 Element Plus `ElForm`、`ElFormItem`、`ElRow`、`ElCol` 承载 Element 版渲染，但表单模型、字段定义、提交和错误透出保持 ConfigForm 契约。
- `DateRangePicker` 和 `PopoverTableSelect` 是当前组件库自己的封装，对外契约写入 `docs/out-components/`，不得作为 Element Plus API 镜像写入本目录。
- `packages/ConfigForm/plugin-element-plus` 只提供只读展示适配器，不介入 ConfigForm core 字段语义。
- 两个 playground 使用 `ElementPlusResolver()` 自动导入 Element Plus 组件，且 `dts` 关闭；生产包构建不依赖 playground 的自动导入配置。

## 交互状态

- Element 版 ConfigForm 通过 Element Plus Form 执行字段校验和 `resetFields`、`clearValidate` 等实例能力。
- `DateRangePicker` 复用 Element Plus DatePicker 的弹层、键盘和禁用日期能力。
- `PopoverTableSelect` 复用 Element Plus Input 与 Popover，但选择、筛选和 slot 契约由本项目组件定义。

## 可访问性

表单场景优先通过 Element Plus FormItem 建立 label、必填和错误提示关系。单独使用 Element Plus 封装组件时，调用方需要提供清晰 placeholder、label 或外层表单语义。

## 测试建议

覆盖 Element Form 校验失败、字段写回、只读适配器展示、DatePicker 禁用边界、Popover 选择回填，以及 playground 自动导入配置不影响构建。

## 缺口

MISSING 官方文档链接归档；本次初始化只基于本仓库 package、源码、README、测试和 lockfile 事实生成。
