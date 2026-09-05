# Packages 循环依赖架构门禁执行计划

- [x] 锁定现有 module graph 的 runtime、dynamic、re-export 与 type-only 边语义。
- [x] 实现稳定 Tarjan SCC collector 与 `module.circular-dependency` 诊断。
- [x] 接入总 architecture diagnostics 与 service barrel。
- [x] 添加二节点、三节点、自环、dynamic/re-export、type-only、重复边和稳定顺序测试。
- [x] 运行 package architecture tests，修复任何真实生产环，不新增宽泛例外。
- [x] 更新目录结构 spec，运行根 lint 与 `git diff --check` 后提交归档。

## 验证记录

- package architecture：18 个测试通过，33 个包、0 tracked debt、0 cycle diagnostic。
- 真实环修复：移除 `FormNode -> RecursiveField` 静态回边，以内部 provide/inject renderer 保持同步递归。
- ConfigForm Runtime unit：23 个文件、210 个测试通过；递归/slot 定向 76 个测试通过且无 Vue warning。
- Element/Antd Runtime smoke：各 11 个测试通过。
- ConfigForm Runtime typecheck、build 与声明 finalizer：通过。
- 根 lint 与 `git diff --check`：通过。
