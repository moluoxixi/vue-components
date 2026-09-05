# Packages 循环依赖架构门禁

## 目标

为 packages 生产模块图补齐循环依赖诊断、精确例外和回归测试。

## 需求

- 基于现有 `createModuleGraph` 检测每个 package `src/` 内的生产运行时依赖环。
- 运行时 import、runtime re-export 与字符串字面量 `import()` 参与检测；type-only import/export、测试和声明文件不参与。
- 两节点、三节点和自环均产生稳定、可复现的 `module.circular-dependency` 诊断。
- 每个强连通分量只产生一个诊断，成员路径按仓库相对路径稳定排序。
- 当前生产代码不得通过新增宽泛例外隐藏循环；若发现存量环，修复依赖方向。
- 不改变现有 feature deep-import、component ownership、composable 与 package entry 诊断语义。

## 验收标准

- [x] architecture collector 自动发现二节点、三节点、自环和 dynamic/re-export runtime 环。
- [x] 纯类型环不产生诊断，重复边不产生重复结果，连续运行顺序稳定。
- [x] 当前 33 个受治理包保持 0 unknown、0 tracked debt、0 cycle diagnostic。
- [x] package architecture tests、根 lint 与 `git diff --check` 通过。
- [x] spec 说明当前门禁只覆盖 package 内可解析的相对生产模块边，不夸大跨包覆盖。

## 范围外

- 不在本批次解析 workspace bare imports、tsconfig paths 或 Vite aliases。
- 不把 type-only 循环升级为运行时错误。
- 不新增永久 cycle exception；必要的存量迁移只能使用精确 debt 并要求后续任务，但本仓当前目标为零 debt。
