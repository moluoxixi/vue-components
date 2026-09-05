# Workspace 包依赖循环门禁设计

## SCC 复用

将 `module-cycles.mjs` 内的 Tarjan 算法迁入私有 `strongly-connected-components.mjs`。调用方提供已稳定排序的节点与邻接边；module/package 两个 collector 仅负责各自图构造和 diagnostic 映射。

## Package 图

- 节点来自 `collectPackageInventory()`，以 manifest `name` 唯一标识。
- 边来自 `dependencies`、`peerDependencies`、`optionalDependencies` 中命中 inventory name 的键。
- 对应 `package.json` 路径作为 diagnostic identity；canonical path 为 SCC 中字典序最小路径，其余进入 owners。
- self dependency 与多包 SCC 均报告 `package.circular-dependency`。

## 兼容

不改变 manifest schema 或现有 package entry/feature/module 规则。现有 debt reconciliation 可直接匹配 `rule + path + owners`；当前仓库目标为零环，不登记 debt。
