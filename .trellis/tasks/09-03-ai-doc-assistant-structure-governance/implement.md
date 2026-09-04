# AI 文档助手结构治理实施计划

1. [x] 锁定 package exports/build entries、CLI command/output、HTTP/stream、Core index/生成与 UI workflow 契约。
2. [x] 补 CLI build-index/serve/unknown/error characterization，运行 CLI 定向测试并提交。
3. [x] 归位 App、ChatView、DetailView 的 7 个单父组件；保持 DemoPreview 动态加载并移动相关测试/import。
4. [x] 将 UI preview compiler 归入 `preview/services`，清理旧 `ui/components`/`ui/views`，运行 UI unit/build/E2E 并提交。
5. [x] 将 Core 19 个根实现迁入 discovery/extraction/generation/indexing/knowledge/retrieval/vector/preview domain，建立纯 barrels并清理 import。
6. [x] 核对并保持 root/core public exports、dynamic vector/store 边界、server/context/router/query-handler 调用方向；运行 Core/server 全量测试并提交。
7. [ ] 拆 ChatView transport/history/request state 到单一 composable，SFC 保留模板与 UI 连接；运行 chat/app/demo/browser tests并提交。
8. [ ] 删除 manifest 中 27 条已消失 debt，运行 live architecture 对账；扫描 P0/P1/P2、logic barrel、owner、deep import和 value/type cycle。
9. [ ] 运行 package test/typecheck/build/E2E、VitePress API-contract consumer typecheck、全仓 lint/architecture/path/workflow 和 `git diff --check`。
10. [ ] 独立只读 review；修复后重跑门禁，更新 README/spec/evidence，提交并归档，不 push。

## 回滚点

- UI owner 与 Core domain 分开提交；旧路径不保留 forwarding shim。
- Core 移动先保持函数体逐字等价，涉及行为优化另建批次并补 characterization。
- ChatView 仅移动现有 state owner，不创建第二套 transport/messages/question 状态。
- package exports、bin、UI base、HTTP/stream/index wire 任一漂移均视为回归。
