# 建设 Studio 项目资产与独立设计面

## 目标

将内部 Workbench 升级为 ConfigForm Studio，为项目、Page、Dialog、Drawer、Dataset 和 Resource 提供清晰的本地创作工作流，并让每个 Surface 使用同一 Designer 独立编辑。

## 前置条件

- `config-form-studio-contracts` 与 `config-form-surface-foundation` 已完成。

## 需求

- R1：首屏为项目管理，支持创建、打开、重命名、复制、导入、导出和删除本地项目；
  项目 JSON 使用 foundation 已固定的 Project transfer v1，不能直接导出 metadata-only
  ProjectDocument。
- R2：项目内固定资产树分组显示 Pages、Dialogs、Drawers、Datasets、Resources，支持搜索、计数和上下文操作。
- R3：点击 Page/Dialog/Drawer 打开同一个 DesignSurface；Page 使用响应式 viewport，Dialog/Drawer 使用真实 presentation 外壳。
- R4：提供与交互编辑器无关的 Surface 创建、选择、打开和定位命令，供资产树与后续交互作者入口复用。
- R5：设计态默认聚焦当前 Surface；从入口打开时保留只读上下文背景和调用路径面包屑。
- R6：删除被引用 Surface 被阻止并展示引用入口；重命名只更新显示名，不改变稳定引用。
- R7：Studio 使用 IndexedDB 自动保存，并提供明确的保存状态、错误和恢复入口。

## 验收标准

- [x] AC1：用户可以从项目列表进入项目，再从资产树进入任意 Page/Dialog/Drawer 设计面。
- [x] AC2：Dialog/Drawer 的标题、尺寸、方向、遮罩和关闭设置在 Surface 属性中编辑，而非伪装成内容节点。
- [x] AC3：直接从资产树打开会重置上下文路径；从交互入口打开会显示来源面包屑和可选只读背景。
- [x] AC4：资产操作全部经过 Model command/history，刷新或重开项目后结果一致。
- [x] AC5：窄屏下资产导航、画布和属性面板仍可到达，文本和控件不重叠。
- [x] AC6：Studio 应用测试、类型检查、构建和关键 Playwright 工作流通过。
- [x] AC7：项目导入先完整读取并校验 document/embedded contents，再原子写入
  Repository；任何 content 失败均不留下部分项目或孤儿 bytes。

## 范围外

- 不实现云项目、协作、发布或公开 Studio SDK。
- 不将 Surface 资产注册成 Designer Material。
- 不在本任务实现“新建并绑定交互”的事务；该事务由 Prototype Interaction 子任务拥有。
