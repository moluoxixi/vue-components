# Workspace 包依赖循环门禁

## 目标

检测 workspace 包 dependencies/peer/optional 形成的稳定循环依赖并接入架构门禁。

## 需求

- 基于 package inventory 构建 workspace package 有向依赖图。
- 仅纳入指向受治理 workspace 包的 `dependencies`、`peerDependencies`、`optionalDependencies`；忽略 external 与 `devDependencies`。
- 二节点、三节点和 self dependency 均产生稳定 `package.circular-dependency` 诊断。
- 每个强连通分量只报告一次，canonical path 与 owners 使用仓库相对 `package.json` 路径排序。
- 抽取并复用已有 module cycle 的 Tarjan SCC 实现，不维护两份算法。
- 当前 workspace manifest 与真实 source 跨包图保持无环，不新增 debt 或宽泛 exception。

## 验收标准

- [x] package cycle collector 覆盖 dependency/peer/optional、两/三节点、自环、external/dev 排除和重复边。
- [x] 总 architecture collector 接入新规则，连续运行结果稳定。
- [x] 当前 33 个包保持 0 package cycle、0 module cycle、0 debt/unknown。
- [x] package architecture tests、根 lint 与 `git diff --check` 通过。
- [x] 全局 spec 分别说明 package graph 与 package 内 source module graph 的覆盖边界。

## 范围外

- 不解析 npm registry 外部包或 `devDependencies` 工具图。
- 不在本批次将 bare source import 解析到具体跨包文件；manifest graph 是 package-level 合同门禁。
- 不新增永久 cycle exception。
