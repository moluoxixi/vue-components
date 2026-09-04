# AI 文档组件发现服务拆分执行计划

- [ ] 盘点并锁定现有 discovery 策略、路径和 export traversal 测试。
- [ ] 迁出 workspace/file/module resolution，运行局部测试。
- [ ] 迁出 AST export traversal，运行 barrel、循环和缺失模块测试。
- [ ] 清理调度器私有重复并确认唯一 server context 消费入口稳定。
- [ ] 运行包级 lint、typecheck、unit、build。
- [ ] 运行 package architecture、`git diff --check`，更新 spec 后提交归档。
