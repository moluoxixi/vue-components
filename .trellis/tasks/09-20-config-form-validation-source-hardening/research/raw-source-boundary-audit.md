# Raw Vue 源码边界审计

## 结论

当前 `RawSourceFileSetV1` 名称虽然表示原生源码，但生成结果仍把内部校验运行依赖带给消费工程，并且 Workbench 将 Raw Vue 与 ConfigForm binding 的生成结果绑成同一个成败单元。两者都不符合“程序员接管原始 Vue 源码”的产品边界。

## 现状证据

### Raw 仍依赖内部运行包

- `packages/ConfigForm/source/src/generator/services/validation.ts` 固定生成 `@moluoxixi/zod3-to-rule` 导入。
- `packages/ConfigForm/source/src/generator/services/emitter.ts` 将 `@moluoxixi/zod3-to-rule` 和 `zod` 写入 Raw 项目的 `package.json`，并在生成的 `Surface.vue` 中运行 `compileRules`。
- `packages/ConfigForm/source/src/generator/__tests__/generator.test.ts` 当前把这些依赖作为正确结果断言，说明问题已经固化进测试合同。

Source 包在生成期使用内部编译能力不构成泄漏；禁止的是生成文件和生成项目清单在运行期继续依赖内部包。

### 消费测试掩盖边界泄漏

- `packages/ConfigForm/source/src/generator/__tests__/generated-consumer.ts` 为生成项目无条件创建 ConfigForm、Headless、Provider adapter 和 `zod3-to-rule` 的工作区软链接。
- Raw 边界断言只禁止 `@moluoxixi/config-form*`，没有禁止所有 `@moluoxixi/*`、`@config-form/*` 和 `zod`。
- 因此现有 typecheck/build 成功不能证明 Raw 项目可在仓库外独立消费。

### 两种导出存在失败耦合

- `SourceProviderResolver` 强制同时提供 `resolveComponent` 和 `resolveConfigFormBinding`。
- `generateVueSource()` 的公共输入校验也要求 binding resolver，因此 Raw 路径无法独立调用。
- `buildExportSnapshot()` 使用 `Promise.all` 后先后抛出任一生成错误，`ExportSnapshot` 又要求 `rawSource` 和 `configBindings` 同时存在。
- 结果是其中一种产物失败时，另一种已经成功的产物也无法展示、复制或下载。

## 目标边界

### Raw Vue

- 生成项目运行依赖只允许 `vue`、`vue-router` 和当前 Provider UI 包。
- Source Generator 可以在生成期解析和预检 RuleSet，但生成文件只包含项目内、具名、直接执行的 TypeScript 校验函数。
- 不生成 Zod schema，不复制通用 RuleSet 解释器、ConfigForm Runtime、Prototype Runtime、session reducer 或 overlay core。
- 支持当前可序列化 base、optional/nullable、Required、内建规则与 compare；`custom`、未知规则、非法正则/日期/类型在生成期 fail closed。
- `multipleOf` 使用十进制缩放后的整数比较，避免直接浮点取模。

### ConfigForm binding

- 保持独立、可选的 `ConfigBindingFileSetV1`。
- 只生成公开 ConfigForm 配置绑定和所需公开依赖，不把 Workbench 或 Prototype Runtime 核心复制进去。

### Workbench

- Raw 与 binding 各自保存 `ready | failed` 结果和诊断。
- 共享输入无效可以使两者同时失败；某一 mode 专属解析或生成错误只能使该 mode 失败。
- 导出弹窗按当前 mode 显示文件树、源码、诊断、复制和下载状态，不使用覆盖全部模式的单一错误。

## 验证要求

- 对 Raw 生成目录的全部文本文件和 `package.json` 做结构化依赖检查。
- 在工作区外临时目录执行真实安装、typecheck 与 build；不得创建内部包软链接。
- Element Plus 与 Ant Design Vue 各覆盖 Required、字符串、数字、日期和 compare。
- 单测 Raw resolver 不提供 binding 能力仍成功；binding 失败时 Raw 仍为 ready，反向同理。
- Export Dialog 分别验证两个 mode 的文件、诊断、复制和下载状态。
