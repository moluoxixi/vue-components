# Studio 数据集与静态资源技术设计

## 当前差距

Model 已有 `ProjectDataset`、`ProjectResource`、引用完整性、项目传输和 Repository 字节存储；缺少可复用的 Dataset 查询服务、Dataset/Resource 单资产传输，以及 Workbench 中真正可操作的资产编辑器。Source 仍在 `source/src/generator/services/emitter.ts` 私有实现 projection，必须改为消费 Model 共享合同。

## 边界与所有权

- Model 负责 JSON-safe 校验、裸 rows ingestion、精确 v1 transfer reader/writer、own-property 路径、options/table/list projection、过滤、稳定排序和分页。
- Workbench `features/datasets` 与 `features/resources` 负责编辑器、冲突策略、文件读写、Repository 原子提交和资产命令；不绕过 Model history。
- Designer 只根据 Registry capability 提供 Dataset binding；“保存为数据集/解除引用”是 Workbench/Model 单事务命令，不在 Options Setter 内复制项目状态。
- Compiler、Experience、Source 只消费 Model 查询结果；Source 删除私有 `projectDataset`。

## 共享服务合同

- `createDatasetFromRows(rows, metadata)` 只接受对象数组；裸数组交给 envelope reader 必须拒绝。
- `readDatasetTransfer`/`writeDatasetTransfer` 只接受 `{ kind: 'config-form-dataset', version: 1, dataset }`。
- `readDatasetPath` 拒绝继承属性和危险路径段；`projectDatasetRows` 要求 options value 为唯一 `string | number`，缺失、重复、null、boolean、对象和数组均返回 `dataset_projection_invalid`，不产出部分结果。
- `queryDatasetView` 顺序固定为 filter -> 稳定多键 sort -> zero-based page，输入和嵌套值不可变，`total` 为分页前数量。
- Resource transfer 复用现有 canonical base64/hash/预算校验；embedded bytes 与 metadata 一次性提交，URL 不读 bytes。

## 作者体验

资产树 Dataset/Resource 行必须可聚焦、选择和操作。Dataset 编辑器提供表格与 JSON 双视图，嵌套对象/数组以 JSON 为权威；错误显示路径、行列，默认导入冲突策略为“作为副本”，并支持覆盖/跳过。Resource 编辑器区分 URL 与 embedded，展示 fileName、大小、hash，导入/替换失败不留下孤儿 bytes。

## 验证与回滚

先完成 Model 纯服务和测试，再接 Workbench UI。所有事务失败保持 document/history/Repository 不变；运行 Model、Source、Designer、双 Provider、Workbench typecheck/test/build 及 Dataset/Resource Playwright。若表格无法无损表示嵌套值，保留 JSON 权威编辑，不扁平化。
