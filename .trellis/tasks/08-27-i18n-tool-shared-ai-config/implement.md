# 国际化工具与共享 AI 配置实施计划

## 执行顺序

- [x] 完成 `08-27-shared-ai-provider-migration`，稳定共享 AI 契约与 AI 文档助手兼容层。
- [x] 完成 `08-27-i18n-json-translation-core`，稳定统一资源模型、JSON adapters 和翻译 operation。
- [x] 完成 `08-27-i18n-local-service-safe-write`，稳定 config/CLI/BFF 与 preview/apply 协议。
- [x] 完成 `08-27-i18n-workbench-e2e`，实现 UI 并完成真实浏览器集成。
- [x] 回到父任务执行跨包依赖、发布、secret 隔离和端到端回归评审。

父任务本身不启动实现；每次只启动当前拥有交付物的子任务。

## 集成门禁

- [x] `@moluoxixi/ai-doc-assistant` 与 `@moluoxixi/i18n-tool` 只通过 `@moluoxixi/ai-provider` 共享 AI 基础设施。
- [x] UI bundle 无 `./server` 导入、secret sentinel 或绝对本地路径。
- [x] 真实 CLI 可从配置启动，并完成 `scan -> translate -> review -> preview -> apply`。
- [x] Vue I18n、i18next、generic JSON 三类 fixtures 均能创建目标文件和更新缺失项。
- [x] overwrite、stale preview、越界路径、模型坏输出和取消路径均无静默写盘。
- [x] 新包 exports、声明、pack 和 Changesets 元数据完整。

## 最终验证

```bash
pnpm --filter @moluoxixi/ai-provider test
pnpm --filter @moluoxixi/ai-provider typecheck
pnpm --filter @moluoxixi/ai-provider build
pnpm --filter @moluoxixi/ai-doc-assistant test
pnpm --filter @moluoxixi/ai-doc-assistant typecheck
pnpm --filter @moluoxixi/ai-doc-assistant build
pnpm --filter @moluoxixi/ai-doc-assistant e2e
pnpm --filter @moluoxixi/i18n-tool test
pnpm --filter @moluoxixi/i18n-tool typecheck
pnpm --filter @moluoxixi/i18n-tool build
pnpm --filter @moluoxixi/i18n-tool e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm test:pack
```

## 风险与回滚点

- 共享包迁移后先跑 AI 文档助手全套回归；不通过则停在子任务 1，不进入国际化核心。
- adapter round-trip 测试通过前禁止接入文件服务。
- 路径、同源、baseline 和 atomic write 集成测试通过前禁止接入 UI apply。
- UI E2E 必须使用临时 fixture 和 stub AI 上游，测试清理不得触碰工作区真实 locale 文件。
