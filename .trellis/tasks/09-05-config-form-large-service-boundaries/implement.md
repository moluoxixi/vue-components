# ConfigForm P2 服务职责拆分执行计划

- [ ] 锁定 source page 的输出、错误和依赖收集测试。
- [ ] 迁出 portability 与 libraries 服务，保持原调用路径稳定。
- [ ] 运行 export 相关 unit、typecheck、build。
- [ ] 锁定 Monaco 安装、completion、hover、mirror 和 disposal 测试。
- [ ] 迁出 TypeScript 与 Vue language 子服务，保持编排入口稳定。
- [ ] 运行 WorkspaceCodeEditor、Workbench unit、E2E、build。
- [ ] 运行 package architecture、lint、`git diff --check`，更新 spec 后提交归档。

两个服务边界分别形成可回滚的小批次；前一批验证通过后再开始后一批。
