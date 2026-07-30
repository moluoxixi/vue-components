# ConfigForm 运行时质量修复前端实现计划

> 状态：第一阶段实现与验证完成（`PASS`，2026-07-17）。开发者已确认按两阶段方案执行，授权用项目现有文档结构手工替代缺失的 `components-docs`、`test-docs`、`frontend-impl-plan` skills，并明确指示本次缺陷修复直接实现、不新增独立 PRD（`N/A separate PRD`）。

## 上游与项目事实

- 需求来源：开发者确认的 ConfigForm 设计、性能与无插件形态修复请求（2026-07-17）；开发者明确豁免本次缺陷修复的独立 PRD，需求范围由本计划和配套测试设计固化。
- 组件契约：`docs/out-components/RuntimeConfigForm.md`。
- 测试设计：`docs/test/ConfigForm运行时质量修复.md`。
- 项目为 Vue 3.5+、Vite、TypeScript、Vitest、Vue Test Utils 和 Playwright 的 pnpm workspace。
- runtime 主包为 `@moluoxixi/config-form`；`plugin-*` 是普通 runtime adapter 对象，不是 Vue `app.use()` 插件。
- `core + element/antd/shadcn` 是独立 UI-native 轻量路线，不在本轮合并或迁移范围内。

## 改动范围

| 模块 | 目标文件 | 责任 |
|---|---|---|
| runtime 公共契约 | `packages/ConfigForm/runtime/index.ts`、`src/types/`、`src/utils/` | 暴露 Vue 函数组件显式包装入口，保留旧 render function |
| runtime 转换 | `src/runtime/transform.ts`、`src/runtime/readonly.ts` | 保存组件原始 alias，按 alias 解析 readonly adapter |
| runtime 校验 | `src/utils/validate.ts`、`src/composables/use-form/validation.ts` | async Zod、trigger 预检、父链可见性、listener 线性合并、dispose |
| runtime 生命周期 | `src/composables/use-form/index.ts` | 复用 computed 初始化扫描并绑定 scope dispose |
| runtime 只读渲染 | `src/components/ReadonlyField/` | 保持动态 renderer 身份稳定 |
| shadcn adapter | `packages/ConfigForm/plugin-shadcn-vue/src/readonly/` | 缺少 options 时 raw value fallback |
| adapter 发布 | 三个 `plugin-*` 的 `package.json`、AntD/Element `vite.config.ts` | Vue peer 与 external |
| 文档 | runtime/adapter README、`docs/out-components/` | 修正包名、插件生命周期、冲突和无插件选型口径 |

## 接口与类型契约

### Vue 函数组件

- 现有 `component: (context) => VNodeChild` 继续表示 ConfigForm `RenderFunction`，不改变现有调用方。
- 新增根入口 helper `asVueFunctionalComponent(component)`；它返回普通 Vue 组件对象，使 runtime 走 `h(component, attrs, slots)` 分支。
- 不尝试通过函数属性猜测两种函数语义；未包装的函数仍按旧 render function 处理。

### 组件 alias 与 readonly

- resolved node 新增只读运行时元数据 `resolvedComponentKey?: string`，仅在输入组件为 registry 字符串 key 时存在。
- readonly adapter 先读取 `resolvedComponentKey`，再回退原生标签或组件稳定 `name`。
- 用户 runtime adapter 与插件 adapter 同 key 继续抛 `CONFIG_FORM_READONLY_ADAPTER_KEY_CONFLICT`。

### Zod 与校验生命周期

- 表单异步链 `validateFieldRules` 使用 `safeParseAsync`，支持同步和异步 Zod schema。
- 公开同步 helper `validateField` 保持同步；传入 async Zod schema 的行为不在该 helper 契约内。
- 非匹配 `validateOn` 的交互触发在入队前返回；仍保留隐藏、禁用、只读字段的清错语义。
- validation dispose 使用结构化错误拒绝 pending Promise；运行中的异步 validator 完成后不得写入已卸载表单。

## 实现步骤

1. 先写 CF-C001 至 CF-C006、CF-P001 至 CF-P006 的失败测试。
2. 实现 `asVueFunctionalComponent` 和根门面导出，不修改旧 render function 分支语义。
3. 为 resolved node 保存组件 alias，修复 readonly adapter 解析。
4. 接入 async Zod、校验预检、父链可见性和 validation dispose。
5. 稳定 readonly renderer 身份，修复 shadcn options fallback。
6. 修改 adapter peer/external，更新 lockfile，构建并检查产物。
7. 修正文档漂移和选型说明。
8. 运行目标包测试、类型检查、构建、lint 和 E2E。
9. 编码完成后立即启动独立前端评审子代理；所有 `FAIL`/`MISSING` 修复后复审。

## 两阶段门槛

### 第一阶段：正确性与低风险优化

- 范围：本计划“改动范围”表中的 runtime 正确性、校验预检/清理、readonly renderer、shadcn fallback、adapter peer/external 和文档修复。
- 进入条件：开发者已确认直接实现；RuntimeConfigForm 目标契约、测试设计和本实现计划均为 `ACCEPTED`，且独立文档校验除已明确豁免的独立 PRD 外无阻断项。
- 退出条件：CF-C、CF-P、CF-B、CF-R、CF-E 第一阶段用例通过；相关 build/typecheck/lint/coverage/E2E 无未解释失败；独立前端评审全部 `PASS`。

### 第二阶段：结构性性能重构

> 2026-07-18 续作已完成匹配 change/blur 快照增量化、深层 slot 字段收集线性化和 pending 队列游标化；深层 visibility cache、批量 errors 更新与 schema 节点缓存仍保留在后续范围。

- 范围：slot 深拷贝与字段收集、深层 visibility cache、匹配 change/blur trigger 的大表快照策略、批量 errors 更新和 schema 节点缓存。
- 进入条件：第一阶段已交付；性能矩阵已有可重复基线；至少一个结构性热点在目标规模下有实际超标证据；另行输出 L2 设计与测试报告并获确认。
- 退出条件：渐进复杂度或确定性调用次数达到第二阶段报告目标，墙钟数据改善且第一阶段全部回归继续通过。
- 不触发场景：只有静态复杂度推断、目标表单规模不使用深层 slot/大批错误，或优化需要破坏插件隔离但收益没有实测证据。

## 不在本轮实现

- 不新增第三套“无插件版”或新的 ConfigForm 包。
- 不合并 runtime 与 UI-native 两套字段协议。
- 不直接重写 slot 深拷贝、深层 visibility cache 或批量 errors 提交；先交付基线。
- 不改变 `defaultValues` 与 UI-native `v-model` 的产品边界。
- 不重命名已发布的 `plugin-*` 包；文档统一称为 runtime adapter。

## 风险与回滚

- 风险：校验预检可能改变 schema 在 16ms 窗口内动态替换的观察时机。控制方式是只对当前明确不匹配 trigger 的请求同步返回，并覆盖响应式 schema 回归。
- 风险：新增 resolved metadata 可能被 render context 观察到。字段为可选只读属性，不改变用户输入对象。
- 风险：新增 Vue peer 后，消费方缺少 Vue 会在安装期显式暴露；这是直接依赖的正确约束。
- 回滚：各修复按 runtime、shadcn adapter、发布清单三组独立提交面组织；出现回归时可按组回退，不影响 UI-native 包。

## 验收标准

- `docs/test/ConfigForm运行时质量修复.md` 中第一阶段用例全部 `PASS`。
- 2026-07-17 修复前基线的 22 个测试文件、168 个相关用例无回归。
- AntD/Element adapter 新构建产物不包含 `@vue/shared`，三包声明 Vue peer。
- 无外部 runtime adapter 的基础 ConfigForm 用法继续通过。
- 独立前端评审的正确性、安全、性能、规则符合性、契约一致性和测试充分性全部 `PASS`。
