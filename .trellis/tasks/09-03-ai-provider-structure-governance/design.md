# AI Provider 结构治理技术设计

## 1. 稳定外部边界

保持三条入口及符号集合不变：

```text
@moluoxixi/ai-provider        -> browser-safe shared
@moluoxixi/ai-provider/shared -> browser-safe shared
@moluoxixi/ai-provider/server -> targets + SDK factories + status/cause/redaction
```

`package.json` exports、Vite named entries、`dist/{index,shared,server}` 文件名与 consumer import 不调整。root 与 shared 继续等价；server-only 符号不得进入前两条入口。

## 2. Shared 责任结构

```text
src/shared/
  index.ts
  constants/{provider.ts,error.ts,index.ts}
  errors/{ai-provider-error.ts,index.ts}
  types/{provider.ts,error.ts,index.ts}
  validation/{provider.ts,index.ts}
```

- types 定义 Provider IDs、status DTO 与 error options/code。
- constants 提供运行时 Provider/error code 集合。
- validation 提供 ID guards。
- errors 提供稳定、secret-free 的 `AiProviderError`。
- shared 各层不依赖 server。

## 3. Server 责任结构

```text
src/server/
  index.ts
  types/{model-target.ts,index.ts}
  adapters/{model-factory.ts,index.ts}
  services/{error-cause.ts,runtime-status.ts,index.ts}
  utils/{redact-sensitive-text.ts,index.ts}
```

- model target types 独立拥有 secret-bearing target unions。
- model factory adapter 只负责 target 边界校验与 Vercel AI SDK Provider 构造。
- runtime status service 只将 target 配置投影为 secret-free DTO。
- error-cause service 继续用 WeakMap 保存 server-only cause。
- redaction utils 保持 raw、URI 与 form encoding 的纯转换语义。

## 4. 依赖方向

```text
shared/types -> none
shared/constants -> shared/types
shared/validation -> shared/constants + shared/types
shared/errors -> shared/types
server/types -> shared/types
server/services -> server/types + shared
server/adapters -> server/types + server/services/error-cause + shared
server/utils -> none
```

入口只聚合 responsibility barrels。内部实现不反向导入 root/shared/server package facade，避免自引用和意外扩大 browser bundle。

## 5. Characterization 与验证

- entry test 同时导入 `../index`、`../shared`、`../server`，锁定 root/shared 等价与 server-only 负向集合。
- model factory tests 覆盖 chat 4 分支、embedding 3 分支、blank fields、compatible URL scheme/credentials/query/fragment 与未知 runtime provider。
- error/redaction 原测试保持，移动后只经公开 `../server` 消费。
- package build 检查三条产物和声明；packed Node/browser smoke 验证 SDK adapter 可解析且 server-only 标记不进入 browser bundle。
- AI-doc/i18n build 验证现有公开 consumer，无需修改 consumer 源码。

## 6. 兼容与回滚

按 characterization、shared、server、README/manifest 四个批次提交。移动阶段保持实现逐段等价；任何公开 symbol、validation error、SDK `provider/modelId` 或 browser-safe entry 漂移，只回滚对应批次，不恢复旧私有路径 shim。
