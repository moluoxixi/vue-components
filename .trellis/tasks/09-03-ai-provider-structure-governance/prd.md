# AI Provider 结构治理

## 目标

治理 `packages/ai-provider` 的 browser-safe shared 契约、server-only target、SDK adapter、状态投影、诊断 cause 与脱敏职责，使入口和实现可按责任定位，同时保持三条公开 subpath、导出符号、Provider 校验、SDK 模型构造与错误行为不变。

## 背景

- Architecture manifest 有 4 条本任务精确债务：`src/shared/index.ts` 含业务实现，`src/server/{error,model-factory,redact}.ts` 位于 feature 根。
- 包生产代码仅 316 行，无 P0/P1/P2 巨型文件；问题是职责混放，不需要行数驱动的机械拆分。
- 公开入口为 `.`, `./shared`, `./server`；root 与 shared 必须等价且 browser-safe，只有 server 可暴露 secret-bearing targets、SDK factories、cause accessor 与 redaction。
- 全仓消费者只使用上述公开 subpath，没有 `src` deep import；AI-doc 与 i18n-tool 均依赖稳定的 browser/server 边界。
- 现有 20 个执行测试覆盖 provider 分支、基础校验、状态、错误 cause 与 redaction，但缺 root/shared 等价、server-only 负向导出和完整 compatible URL/embedding 校验矩阵。

## 需求

1. 清零 4 条 architecture debt，不新增 unknown/stale diagnostic，不保留旧私有路径 forwarding shim。
2. 将 shared 拆为 `types`、`constants`、`validation`、`errors`；`src/shared/index.ts` 仅聚合 browser-safe responsibility barrels。
3. 将 server 拆为 `types/model-target`、`adapters/model-factory`、`services/{error-cause,runtime-status}`、`utils/redact-sensitive-text`；`src/server/index.ts` 仅聚合公开 server 符号。
4. 保持 `AI_PROVIDER_IDS`、`EMBEDDING_PROVIDER_IDS`、guards、`AiProviderError`、target unions、model factories、status、cause 与 redaction 的名称和运行时语义不变。
5. 保持 `.`, `./shared`, `./server` 的 source/types/import 条件与 `dist/{index,shared,server}.{js,d.ts}` 产物名不变；root/shared 不得泄漏 server-only 符号。
6. 在移动前补 root/shared runtime 等价与 server-only 负向 characterization；补 whitespace、protocol、credentials、query、fragment 及 embedding target 验证矩阵。
7. 新增默认中文 README，说明三条入口、支持的 chat/embedding Provider、compatible URL 约束与 secret 边界。
8. 每个稳定边界独立提交；运行 package test/typecheck/coverage/build、AI-doc/i18n consumers、architecture、packed Node/browser smoke 与全仓 lint。

## 验收标准

- [x] 4 条目标 debt 删除，architecture unknown/stale 为零。
- [x] shared/server feature 根只含纯 `index.ts` 与责任目录，旧 server 根实现路径不存在。
- [x] root 与 `./shared` 运行时符号集合等价，且都不暴露 target、factory、status factory、cause 或 redaction。
- [x] `./server` 保持原公开符号集合，Provider/model/baseURL 校验与 SDK model metadata 不变。
- [x] shared 不依赖 server；server adapters/services/utils 依赖方向无 emitted-value cycle。
- [x] README、package exports、Vite entries、声明与实现一致。
- [x] package test/typecheck/coverage/build、consumer builds、architecture、packed smoke、全仓 lint 与 `git diff --check` 通过。
- [x] 独立只读 review 无阻断项，所有批次已提交但未 push，归档时工作树干净。

## 范围外

- 不新增 Provider、模型默认值、重试、stream/generate/embed orchestration 或产品环境变量。
- 不改变 root/shared/server 公开 API，不增加 compatibility subpath 或旧私有路径 shim。
- 不修改 AI-doc、i18n-tool 的配置语义；consumer 只用于验证公开边界。
- 不直接维护 `dist`、coverage 或其他生成产物。

## 关键决策

- shared 的 error class 保持 browser-safe；server-only cause 继续存于 WeakMap service，不进入可序列化 error。
- model target types 与 SDK adapter 分离；状态投影单独归入 service，redaction 作为纯函数归入 utils。
- 父任务 standing approval 覆盖本子任务的内部重构与 phase transition；只有公共 API、行为或跨包依赖方向变化才重新确认。
