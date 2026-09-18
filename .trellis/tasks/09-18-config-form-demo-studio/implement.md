# ConfigForm Demo Studio 实施计划

## 执行原则

- 父任务只管理需求、依赖和最终集成，不直接作为实现任务启动。
- 每个子任务在启动前补齐自身 `design.md`、`implement.md`、研究和 JSONL context，并单独经过用户审阅。
- 跨版本硬切在所属子任务内原子完成；不以兼容层连接半成品。
- 每个阶段都保持可测试、可构建，最终再做完整发布批次。

## 顺序

### 1. 产品与合同

任务：`09-18-config-form-studio-contracts`

- 更新长期产品文档和 `.trellis/spec/` 可执行合同。
- 最终确定 Prototype Runtime 包名与入口、Surface/Dataset/Interaction 签名、provider-neutral Source resolver、错误矩阵和版本表。
- 将目标合同与当前 Page-only 实现状态分开记录，禁止提前宣称规划中的包或 API 已可用。
- 建立跨包架构测试清单。

退出门槛：所有后续任务只需引用合同，不再拥有未决产品命名或所有权问题。

### 2. Surface 领域基础

任务：`09-18-config-form-surface-foundation`

- 原子切换 Model、Repository、IndexedDB、Compiler、Canonical IR、Vue backend、Workbench import/session/runtime-host，以及仍留在 Workbench 的现有 Source 读取路径。
- 建立 Surface/Dataset/Resource 引用索引、commands、undo/redo 和 change set。
- 完整实现 `@moluoxixi/config-form-prototype-runtime` v1：纯会话 reducer、页面历史、overlay instance 栈、参数/结果事务、主要 UI 动作，以及 Vue host。

退出门槛：Page/Dialog/Drawer 可持久化、编译和实例化；所有旧合同 fail closed。

### 3. Studio 资产与设计面

任务：`09-18-config-form-studio-assets`

- Workbench 产品身份和导航升级为 Studio。
- 实现项目首屏、资产树、Surface 外壳、调用路径和自动保存状态。
- 建立与交互编辑器无关的 Surface 创建、选择、打开和独立设计工作流。

退出门槛：用户可完整管理并编辑三类 Surface，尚不要求全部体验交互可运行。

### 4. Dataset / Resource 与业务物料

任务可在 Surface 基础稳定后分批推进：

- `09-18-config-form-studio-datasets`
- `09-18-config-form-studio-materials`

Dataset 先完成领域、编辑器与纯查询/投影引擎，再由业务物料消费结果。基础物料、布局和 Token 可提前并行，但 Materials 的完整验收必须等待 Dataset；两套 adapter 必须以共同语义基线验收。

退出门槛：静态对象数据能驱动 options、Table、List 和资源物料，双 adapter 预览一致。

### 5. Prototype Interaction 与 Experience

任务：`09-18-config-form-studio-interactions`

- 恢复并重建面向 Demo 的状态/值作者体验。
- 将语义激活器、参数/结果映射和 Experience UI 接入 foundation 已完成的 Prototype Runtime，不在本任务重写页面历史或浮层栈。
- 实现从交互入口原子创建、绑定并打开新 Surface 的事务流程。
- 完成 Design/Experience 切换和跨 Surface E2E。

退出门槛：Studio 内可完成、保存、重开并演示完整本地 Demo。

### 6. Source 包与导出接入

任务：`09-18-config-form-source-package`

- 迁移并重构 Generator。
- 实现独立 Source Viewer。
- Studio 导出弹窗直接消费公共包。
- 用真实生成项目验证双 adapter 和 Prototype Runtime parity。

退出门槛：生成项目 install/typecheck/test/build 通过，旧 Workbench 生成实现零残留。

### 7. 父任务集成检查

- 对照父 PRD 的 AC1-AC12 做全量审计。
- 跑所有 ConfigForm package tests、typechecks、build、architecture、release、frozen lockfile 和关键 Playwright。
- 检查产品文档、README、Changeset、peer range 和 package exports。
- 只在全部子任务归档后归档父任务。

## 关键验证命令

具体命令由合同子任务确认，至少覆盖：

```powershell
pnpm test:config-form-packages
pnpm test:package-architecture
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-compiler test
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @config-form/workbench test --maxWorkers=2
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm test:release
pnpm install --lockfile-only --frozen-lockfile
```

新增包在建立后补入相应 filter、生成模板和 release gate。

## 停止条件

- 产品合同出现新的用户决策：回到规划，不在实现任务内代选。
- 子任务需要越过其 PRD 修改另一子任务所有权：更新父设计与依赖顺序后重新审阅。
- 为通过中间状态而需要兼容层：停止并重新设计原子切换边界。
