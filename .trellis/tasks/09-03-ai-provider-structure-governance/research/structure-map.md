# AI Provider 结构调研

## Architecture Debt 与规模

- 4 条精确 debt：`src/shared/index.ts` 的 `feature.index-barrel-only`，以及 `src/server/error.ts`、`model-factory.ts`、`redact.ts` 的 `feature.root-file`。
- 生产代码 8 个 TS 文件、316 行；最大 `model-factory.ts` 156 行，无 P0/P1/P2 热点。
- 当前静态图无循环，无动态 import；所有工作区 consumer 均使用公开 subpath。

## 职责现状

- shared index 混合 error codes/class、Provider constants/types、ID guards 与 status DTO。
- model factory 混合 target types、target validation、SDK adapter 和 runtime status projection。
- server error 使用 WeakMap 保存不可序列化 cause；redaction 是无状态纯转换。

## 目标移动矩阵

| 当前 | 目标 |
| --- | --- |
| shared error types/codes | `shared/types/error.ts` + `shared/constants/error.ts` |
| shared Provider/status types | `shared/types/provider.ts` |
| Provider ID arrays | `shared/constants/provider.ts` |
| Provider guards | `shared/validation/provider.ts` |
| `AiProviderError` | `shared/errors/ai-provider-error.ts` |
| server target types | `server/types/model-target.ts` |
| SDK model factory | `server/adapters/model-factory.ts` |
| diagnostic cause | `server/services/error-cause.ts` |
| runtime status | `server/services/runtime-status.ts` |
| redaction | `server/utils/redact-sensitive-text.ts` |

## 风险

- root/shared 必须保持 browser-safe 等价集合，server-only target/factory/cause/redaction 不得泄漏。
- `ai`、`@ai-sdk/*` 与 Node 内置继续 external；三条 build entry/产物名不变。
- 移动后不能通过旧根文件 shim 隐藏 debt。
