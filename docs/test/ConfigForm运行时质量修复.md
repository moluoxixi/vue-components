# ConfigForm 运行时质量修复测试设计

> 状态：第一阶段与第二阶段已实现，代码验证 `PASS`（2026-07-18）；知识源治理校验 `FAIL`，不纳入代码测试结果。第二阶段本次完成匹配 change/blur 快照增量化、深层 slot 字段收集线性化和 pending 队列游标化。

> 前置门禁：开发者于 2026-07-17 明确指示直接实现，不新增独立 PRD；本文件与已确认的实现计划共同作为本次缺陷修复上游，状态 `N/A separate PRD`。

## 测试目标

- 修复 runtime render function、Vue 函数组件、readonly adapter、异步 Zod 和校验生命周期的已确认问题。
- 验证无外部 runtime adapter 的使用方式保持可用。
- 消除默认只在 submit 校验的字段在 change/blur 阶段创建整表快照和定时器的额外工作。
- 验证 runtime adapter 发布产物不再内联 Vue 运行时代码，并声明直接 Vue peer dependency。
- 建立大表单和深层 slot 的可重复性能基线，并实施已确认的快照与字段收集热点优化。

## 测试分层

| 层级 | 工具 | 范围 |
|---|---|---|
| 单元 | Vitest | 字段转换、readonly key、Zod、校验预检、生命周期清理、shadcn options |
| 组件交互 | Vitest + Vue Test Utils | render function、Vue 函数组件包装、值写回、只读展示、卸载后的 pending validation |
| 类型契约 | vue-tsc + 类型测试 | `asVueFunctionalComponent`、公开入口、现有 `defineField` 推导 |
| 发布集成 | Vite build + 产物检查 | exports、peer dependency、Vue external、产物中无 `@vue/shared` |
| 浏览器回归 | Playwright | 现有 Element/AntD/shadcn 轻量表单关键提交路径 |
| 性能基线 | Vitest 确定性计数 + 报告型耗时 | 100/1000 平铺字段、50/200 层 slot、连续 change、全错误提交 |

## 用例矩阵

| ID | 场景 | 预期 | 状态 |
|---|---|---|---|
| CF-C001 | `component` 使用现有 ConfigForm render function | 继续接收 `RenderContext`，行为不变 | PASS |
| CF-C002 | Vue 函数组件经 `asVueFunctionalComponent` 包装 | 按 Vue props/emit/slots 协议渲染并写回值 | PASS |
| CF-C003 | 字符串 alias 注册匿名组件及同名 readonly adapter | readonly 按原始 alias 命中 adapter | PASS |
| CF-C004 | 字段使用 async Zod refine/transform | `validateFieldRules` 等待异步结果，错误正常进入字段错误集合 | PASS |
| CF-C005 | shadcn 选择字段 readonly 且缺少或传入非数组 `props.options` | 展示原始值，不抛异常 | PASS |
| CF-C006 | 用户 runtime readonly adapter 与 adapter 同 key | 保持冲突即报错，不静默覆盖 | PASS |
| CF-C007 | 整表校验与后发字段校验交错完成 | 返回值和 `onError` 使用请求私有结果；UI 错误按字段保留最新请求 | PASS |
| CF-C008 | 字段键为空字符串且其它字段已有错误 | 只清理空字符串字段自身错误，不清空整表 | PASS |
| CF-C009 | 空表单 effect scope 已 dispose 后调用 validate/submit | 两个入口均拒绝 disposed 错误，不触发 submit | PASS |
| CF-C010 | 慢 submit 期间触发不匹配的 blur | blur 不执行规则，也不抢占 submit 的 UI 错误写入权 | PASS |
| CF-C011 | 空表单 validate/submit 已开始后 effect scope dispose | 微任务恢复后拒绝 disposed 错误，不触发 submit | PASS |
| CF-P001 | 默认 `validateOn: ['submit']` 字段触发 change/blur | 不创建校验 timer、不运行 validator；仅解析目标父链以保留 hidden/disabled/readonly 清错语义 | PASS |
| CF-P002 | 单字段交互校验需要执行 | 仅解析该字段父链可见性，不遍历全字段可见性 | PASS |
| CF-P003 | 同一节流窗口连续 100 次 change | 所有调用共享最新请求结果，listener 合并保持线性追加 | PASS |
| CF-P004 | `useForm` 初始化 | 字段收集和拓扑构建复用 computed 结果，不重复主动扫描 | PASS |
| CF-P005 | effect scope/组件在 pending timer 前卸载 | timer 被取消，pending Promise 显式拒绝，validator 不再执行 | PASS |
| CF-P006 | readonly 值变化 | readonly renderer 组件类型保持稳定，展示值更新 | PASS |
| CF-P007 | 100 次匹配 change 请求覆盖约 1000 个顶层值 | 共享 pending 快照；源值只做有限次枚举，跨字段/direct 写入可增量重放 | PASS |
| CF-P008 | 50/200/1000/2048 层 slot 或 pending 队列 | 字段收集与队列消费不产生累计数组搬移；队列游标在排空后释放日志保留 | PASS |
| CF-P009 | submit 对 500 个字段复用同一 values/visibility context | 不为每个字段重复扫描顶层 descriptor，保持单次提交快照隔离 | PASS |
| CF-B001 | AntD/Element adapter 构建 | `vue` 为 external，产物不包含 `@vue/shared` | PASS |
| CF-B002 | 三个 runtime adapter 清单 | `peerDependencies.vue` 为 `^3.5.0` | PASS |
| CF-B003 | 各包公共入口加载 | package root 的 named exports 与类型声明可解析 | PASS |
| CF-R001 | 无 `runtime.plugins` 渲染基础字段 | 注册组件、原生标签、校验和 raw readonly fallback 可用 | PASS |
| CF-R002 | 2026-07-17 修复前基线：runtime/core/三套 UI-native/三个 runtime adapter 共 22 个测试文件、168 个用例 | 全部保持通过；修复后共 29 个文件、217 个用例通过 | PASS |
| CF-E001 | 轻量 ConfigForm playground | Element/AntD/shadcn 提交关键路径通过 | PASS |

## 性能基线矩阵

| 数据集 | 观测项 | 本轮门槛 |
|---|---|---|
| 100 / 1000 个平铺字段 | change 预检、提交校验、errors 更新调用次数 | 记录基线；change 非匹配 trigger 必须为零 validator/visibility 调用 |
| 50 / 200 层 slot 链 | transform hook、clone 和 visibility predicate 调用次数 | 记录当前增长趋势，不以墙钟阈值阻断 |
| 100 次同字段 change | validator 最大并发、listener 数、最终错误 | 最大并发 1，所有 Promise 收敛到最新结果 |
| 100 次匹配 change × 1000 个顶层值 | ownKeys 枚举次数、增量日志后缀、快照一致性 | 不随请求数复制整表；访问器/重入写入回退安全快照 |
| 2048 次不可合并 change/blur | pending 游标消费、revision cursor、前缀压缩 | 排空后 retention 关闭；不使用头删导致 O(N²) 搬移 |
| 100 / 1000 个失败字段 | errors 写入次数和耗时 | 记录基线；批量 errors 重构留待第二阶段 |

## Mock 与 Fixture

- Vue 函数组件、render function 和匿名组件均使用测试内本地 fixture，不依赖真实 UI 库。
- Zod 使用本地 async refine/transform，不访问网络或计时服务。
- runtime adapter 构建检查使用各包真实 Vite 配置和构建产物，不 mock Rollup external。
- 性能测试优先统计 hook、predicate、validator 和 listener 调用次数；墙钟耗时只输出报告，避免把机器抖动固化成失败。

## 回归范围与验证命令

```bash
pnpm -C packages/ConfigForm/runtime test
pnpm -C packages/ConfigForm/core test
pnpm -C packages/ConfigForm/element test
pnpm -C packages/ConfigForm/antd test
pnpm -C packages/ConfigForm/shadcn test
pnpm -C packages/ConfigForm/plugin-antd-vue test
pnpm -C packages/ConfigForm/plugin-element-plus test
pnpm -C packages/ConfigForm/plugin-shadcn-vue test
pnpm -C packages/ConfigForm/runtime typecheck
pnpm -C packages/ConfigForm/plugin-antd-vue typecheck
pnpm -C packages/ConfigForm/plugin-element-plus typecheck
pnpm -C packages/ConfigForm/plugin-shadcn-vue typecheck
pnpm -C packages/ConfigForm/runtime build
pnpm -C packages/ConfigForm/plugin-antd-vue build
pnpm -C packages/ConfigForm/plugin-element-plus build
pnpm -C packages/ConfigForm/plugin-shadcn-vue build
pnpm test:config-form-packages
pnpm -C packages/ConfigForm/runtime test:coverage
pnpm lint
pnpm test:e2e:config-form
pnpm -C packages/ConfigForm/runtime test -- src/composables/use-form/__tests__/performance.test.ts
rg -n "@vue/shared" packages/ConfigForm/plugin-antd-vue/dist/index.js packages/ConfigForm/plugin-element-plus/dist/index.js packages/ConfigForm/plugin-shadcn-vue/dist/index.js
node -e "for (const p of ['plugin-antd-vue','plugin-element-plus','plugin-shadcn-vue']) { const j=require('./packages/ConfigForm/'+p+'/package.json'); if (j.peerDependencies?.vue !== '^3.5.0') process.exitCode=1 }"
```

产物检查中的 `rg` 预期退出码为 1 且无命中，表示未内联 `@vue/shared`。coverage 使用 runtime Vite 配置中的既有阈值；性能基线测试输出数据但不设置墙钟失败阈值。

## 验证结果

- `PASS`：runtime、core、三套 UI-native 包和三个 runtime adapter 共 29 个测试文件、217 个用例通过。
- `PASS`：上述八个包的 typecheck 通过；runtime 与三个 runtime adapter 的独立 build 通过，`pnpm test:e2e:config-form` 连带 workspace build 通过。
- `PASS`：runtime coverage 为 statements 97.18%、branches 93.30%、functions 96.70%、lines 97.18%。
- `PASS`：`pnpm lint` 与 ConfigForm Playwright 11 个关键路径通过。
- `PASS`：三套 runtime adapter 的 package self-reference named exports 可加载，公开 value/type exports 通过严格 TypeScript bundler-mode 临时消费方编译，`peerDependencies.vue` 为 `^3.5.0`；产物保留 `from "vue"` 且无 `@vue/shared` 命中。NodeNext 声明解析不在本轮 Vue/Vite 包边界内。

## 风险与未执行项

- 第二阶段剩余范围：深层 visibility cache、批量 errors 更新和 schema 节点缓存；本轮已完成匹配 change/blur 快照、深层 slot 字段收集以及 pending 队列消费优化。
- `PASS optimized matching-trigger snapshots`：pending 交互请求仅在有消费者时保留顶层变更日志；兼容请求按 revision 增量刷新，访问器和重入写入使用安全回退。
- `PASS deep-slot linearization`：字段收集改为单次 preorder DFS，保持节点/slot/错误顺序，不再使用嵌套 flatMap 的累计数组复制。
- `FAIL knowledge source registry`（治理范围，非代码测试）：`airules.knowledge.json` 存在，但仓库缺少注册表要求的 `verify-knowledge-sources.mjs`，本轮无法完成受治理知识源校验；因此只声明实现与代码验证 `PASS`，不声明知识源治理通过。实现依据为已确认计划、组件契约、源码与测试。
- async validator 无法强制取消；卸载清理保证 pending 调用方显式结束，并阻止卸载后写入表单错误状态。
