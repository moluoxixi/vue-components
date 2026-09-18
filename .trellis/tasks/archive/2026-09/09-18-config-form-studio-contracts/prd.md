# 固化 ConfigForm Studio 产品与领域合同

## 目标

在任何实现开始前，将已确认的 Demo Studio 产品边界转化为可执行、可版本化、可测试的领域合同和依赖规则，消除旧 Runtime-first 文档中“Designer Lite、Workbench internal”与新方向的冲突。

## 需求

- R1：更新长期产品文档，明确 Studio、Designer、Runtime、UI adapters 与 Source 的责任和目标用户。
- R2：定义 `SurfaceAsset`、`SurfaceInstance`、`Dataset`、`PrototypeInteraction`、参数、结果和静态资源的公共术语与所有权。
- R3：定义 Page、Dialog、Drawer 的共同字段、差异化 presentation、引用规则和运行实例语义。
- R4：定义安全表达式、状态表达式、值动作和主要 UI 动作的封闭联合，明确禁止任意事件名、脚本和动作链。
- R5：定义 Dataset 的 JSON 对象数组、映射、引用、导入导出和只读运行边界。
- R6：定义当前合同硬切、版本提升、包依赖方向、发布和测试矩阵。
- R7：明确现有动态 Data Source 继续属于 Runtime 代码态能力，但从 Studio 作者体验移除。
- R8：明确长期文档中的“目标合同”和各包 README 中的“当前实现”，不得把 Surface、Prototype Runtime 或 Source 新包写成已落地能力。
- R9：定型 Prototype Runtime 的包名、纯会话入口、Vue overlay host 入口及依赖方向，确保 Studio Experience 与生成项目共享实现且生产 Runtime 不反向依赖。
- R10：定型 Dataset 纯查询/投影与 Materials 渲染的所有权，以及 Source generator 分离
  的 provider-neutral component resolver / async Resource reader 注入合同。
- R11：列出现有 Page-only 合同基线、目标版本表、原子切换范围和稳定错误码/诊断上下文。
- R12：定型 Safe Expression 的确定求值语义、Project/Resource transfer v1、embedded
  content 完整性与资源预算，确保实现任务无需自行发明兼容或存储约定。

## 验收标准

- [ ] AC1：`PRODUCT.md`、`ROADMAP.md`、ConfigForm 架构入口和相关包说明不存在互相矛盾的产品定位。
- [ ] AC2：`.trellis/spec/` 中存在含签名、合同、错误矩阵、案例和测试点的 Studio 跨包规范。
- [ ] AC3：Surface/Material/Instance、Dataset/Data Source、Prototype Interaction/Event Function 三组概念有清晰且不可混用的定义。
- [ ] AC4：后续六个子任务都能引用稳定合同，不需要自行发明字段、错误或依赖方向。
- [ ] AC5：规范明确旧、未来、缺失和混合版本 fail closed，不保留兼容别名或双模型。
- [ ] AC6：规范明确 Dataset 查询只实现一次、Source 不依赖 Designer/Workbench、Prototype 会话不在 Preview 与生成模板复制。
- [ ] AC7：ROADMAP 与包 README 能清楚区分当前可用能力、正在迁移的合同和目标状态。
- [ ] AC8：完整项目 transfer 可无损携带 embedded bytes，Source 的 provider 解析与
  Repository 读取彼此分离；合同矩阵覆盖表达式、主题、presentation、node kind、
  Dataset/Resource 引用和 binary Source files。

## 范围外

- 不实现 Model、UI、Runtime、Preview 或 Source 代码。
- 不决定未进入已确认产品范围的协作、云端、发布或自定义组件能力。
