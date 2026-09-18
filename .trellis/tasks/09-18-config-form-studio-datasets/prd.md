# 实现 Studio 数据集与静态资源

## 目标

提供可由 UI 设计师管理的项目级静态模拟数据和资源，使 Demo 无需请求接口即可驱动 options、表格、列表与图片等物料。

## 前置条件

- `config-form-surface-foundation` 和 `config-form-studio-assets` 已完成。

## 需求

- R1：Dataset 根为 JSON 对象数组，行内允许嵌套对象和数组；运行期只读。
- R2：提供表格与 JSON 双视图，切换前校验同一份数据，错误定位到路径和行。
- R3：提供两个显式入口：raw rows ingestion 只接受对象数组并创建当前 v1 Dataset；versioned envelope reader 只接受精确当前版本，缺失、旧、未来或混合版本 fail closed。标准导出始终使用版本化 envelope。
- R4：组件引用 Dataset 时配置用途相关投影；options 至少支持 `labelPath/valuePath/disabledPath` 与安全过滤表达式。
- R5：内联 options 可原子保存为 Dataset 并切换引用；解除引用时可物化为内联快照。
- R6：Dataset 修改实时影响引用者；删除被引用 Dataset 被阻止并列出 Surface/节点。
- R7：支持本地筛选、排序和分页，不引入网络请求或 Dataset 写操作；组件选择状态由 Materials 层拥有。
- R8：Resource 使用 `embedded | url` 判别联合；embedded metadata 分离可重命名 name
  与稳定 fileName，记录 byteLength 和 raw bytes 的 SHA-256。单 Resource transfer v1
  对 embedded 携带并校验 canonical base64 bytes，对 URL 不伪造 bytes；Project
  transfer v1 为每个 embedded 恰好携带一份 content、为 URL 携带零份，项目导入时
  metadata/bytes 原子提交。
- R9：Dataset 层提供 adapter-neutral 的字段路径、投影、筛选、排序和分页纯运算；Table/List/Select 物料只消费结果，不复制查询实现。

## 验收标准

- [ ] AC1：嵌套对象数据可导入、编辑、保存、重开并导出，无静默字段丢失。
- [ ] AC2：options 的 value 只能投影为唯一的 `string | number`；缺失路径、重复值和非法类型阻止体验与导出。
- [ ] AC3：同一 Dataset 可用不同映射服务 Select、Table 和 List；字段值不保存整行对象。
- [ ] AC4：覆盖、作为副本、跳过三种导入冲突策略行为稳定，默认作为副本。
- [ ] AC5：引用/解除引用、删除保护和 undo/redo 通过测试。
- [ ] AC6：数据集和资源在完整 Project transfer v1 JSON 与持久化实体中无损往返；
  embedded bytes 逐字节相同，URL 只保留已校验 metadata。
- [ ] AC7：原始对象数组只能经 raw ingestion 创建当前 Dataset；把同一数组交给 envelope reader 会因缺失版本被拒绝，二者不共享宽松解析分支。
- [ ] AC8：Resource/Project transfer Reader 只接受精确 v1；非 canonical base64、
  embedded 内容缺失/重复/额外、长度/hash 不匹配、单文件 10 MiB 或项目 256 项/50 MiB
  预算溢出、危险 URL/filename 和悬空 resourceId 均稳定拒绝。

## 范围外

- 不提供 HTTP、鉴权、加载状态、缓存、刷新和运行时增删改。
- 不把 Dataset 复用为 Runtime Data Source，也不允许字段 value 为对象。
