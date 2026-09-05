# AI 文档组件发现服务拆分执行计划

- [x] 盘点并锁定现有 discovery 策略、路径和 export traversal 测试。
- [x] 迁出 workspace/file/module resolution，运行局部测试。
- [x] 迁出 AST export traversal，运行 barrel、循环和缺失模块测试。
- [x] 清理调度器私有重复并确认唯一 server context 消费入口稳定。
- [x] 运行包级 lint、typecheck、unit、build。
- [x] 运行 package architecture、`git diff --check`，更新 spec 后提交归档。

## 验证记录

- component discovery：9 个测试通过，包含 star/named 循环、workspace re-export、default/named alias 与断链错误。
- `ai-doc-assistant` unit：28 个文件、224 个测试通过。
- `ai-doc-assistant` typecheck、library/UI build 与声明 finalizer：通过。
- 根 lint：通过。
- package architecture：15 个测试通过，33 个包、0 debt。
- `git diff --check`：通过。
