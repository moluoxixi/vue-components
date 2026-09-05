# ConfigForm P2 服务职责拆分执行计划

- [x] 锁定 source page 的输出、错误和依赖收集测试。
- [x] 迁出 portability 与 libraries 服务，保持原调用路径稳定。
- [x] 运行 export 相关 unit、typecheck、build。
- [x] 锁定 Monaco 安装、completion、hover、mirror 和 disposal 测试。
- [x] 迁出 TypeScript 与 Vue language 子服务，保持编排入口稳定。
- [x] 运行 WorkspaceCodeEditor、Workbench unit、E2E、build。
- [x] 运行 package architecture、lint、`git diff --check`，更新 spec 后提交归档。

两个服务边界分别形成可回滚的小批次；前一批验证通过后再开始后一批。

## 验证记录

- Workbench unit：52 个文件、475 个测试通过。
- Workbench typecheck：通过。
- Workbench build：通过 Element Plus 与 Monaco bundle verifier。
- Workbench E2E：79 个测试通过，包含真实 Monaco Vue/Config completion 与 hover。
- package architecture：15 个测试通过，33 个包、0 debt。
- 根 lint 与 `git diff --check`：通过。
