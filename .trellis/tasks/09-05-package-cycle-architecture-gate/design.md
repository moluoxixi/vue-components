# Packages 循环依赖架构门禁设计

## 图边界

对 inventory 中每个 package 单独读取 `sourceRoot` 的 module graph。仅保留 `isProductionModule` 节点以及目标也在同一生产节点集合内的边，因此诊断代表 package 内可解析的运行时模块环。

## 检测算法

- 新增 `services/module-cycles.mjs`，使用 Tarjan 算法计算强连通分量。
- 节点与邻接边都按 `normalizeRepositoryPath()` 排序，避免文件系统遍历顺序影响结果。
- 分量成员超过一个，或单成员存在自边时报告循环。
- canonical `path` 为成员中字典序最小的仓库相对路径，其余成员进入已排序 `owners`。
- rule 固定为 `module.circular-dependency`；一个 SCC 只产生一个诊断。

## 诊断与兼容

现有 manifest debt identity 已支持 `rule + path + owners`，无需复用只面向单 feature import 边的 `importExceptions`。collector 加入总诊断组合后，现有 unknown/stale reconciliation 自动生效。

现有 module graph 已定义 runtime/type-only 边语义，本批次不改变解析器。跨 package bare import 与 alias 尚不进入图，spec 必须明确这一限制。
