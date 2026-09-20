# Studio 项目资产与独立设计面实施计划

## 阶段一：现状验收与领域命令

- [x] 对照 AC1-AC7 建立代码与浏览器证据矩阵。
- [x] 补齐项目重命名等缺失的 Model operation、诊断、history 与测试。
- [x] 复核 Surface 删除引用阻止和 presentation 更新均为单命令、可撤销。

## 阶段二：项目与资产作者界面

- [x] 增加可到达的本地项目管理入口及打开、重命名、复制、导入、导出、删除命令。
- [x] 将 Surface 导航按 Page/Dialog/Drawer 分组，提供搜索、计数和稳定上下文操作。
- [x] 为 Dialog/Drawer 提供结构化 presentation 编辑 UI，并在设计面显示真实外壳。
- [x] 直接资产打开重置上下文；为后续交互入口保留来源面包屑与只读背景合同。

## 阶段三：持久化、响应式与集成

- [x] 验证所有 Surface 编辑经 Model history、自动保存并可刷新重开。
- [x] 验证 Project transfer v1 的 embedded bytes 在导入前完整校验并原子写入。
- [x] 完成桌面、平板、手机布局、键盘焦点和可访问性覆盖。

## 阶段四：质量门禁

- [x] 运行受影响 Model/Workbench 单测与 ESLint。
- [x] 运行相关包 typecheck/build 和 `pnpm test:config-form-packages`。
- [x] 运行资产专项 Playwright（双 Provider、390/900/1440、axe）。
- [x] 运行 `git diff --check`；包架构与 frozen lockfile 纳入父任务统一门禁。
- [x] 更新任务实施记录、必要规范与 README。
- [x] 随 Demo Studio 收尾批次提交并归档本子任务。

## 验收证据

- 项目首屏、项目生命周期命令、Pages/Dialogs/Drawers 分组资产树和真实 Surface 外壳均已接入 Workbench；项目与 Surface JSON 导入 E2E `4/4` 通过。
- Surface 编辑继续走 Model command/history、自动保存和 Repository；交互专项覆盖创建 Dialog/Drawer、重开项目并继续编辑，`interaction.spec.ts` `53/53` 通过。
- 当前 Workbench 全量 Playwright `81/81` 通过；其中模板管理 `14/14`、完整 axe 矩阵 `8/8`，覆盖 `390/900/1440` 视口、双 Provider、焦点恢复、无横向溢出和现行 Win32 视觉基线。
- Workbench 单测、typecheck、build、ConfigForm 包门禁和发布门禁的最终批次结果记录在父任务；全仓 package architecture 的范围外既有基线单独列明，不计为本子任务回归。

## 最终验证记录（2026-09-21）

- Workbench 单测 `50 files / 564 tests`、全量 E2E `81/81`、typecheck/build 均通过。
- `pnpm test:config-form-packages` 的 `16/16` build tasks 与 public package boundaries 通过；`pnpm test:release` 的 38 项、path contracts `8/8` 和 components playground typecheck 通过。
- frozen lockfile 校验通过；ConfigForm architecture boundaries `7/7` 通过。
- 全仓 `pnpm test:package-architecture` 仍仅因未修改的 `qiankun-router-kit` 与 `vite-plugin-style-scope` 共 27 条既有诊断退出非零。

## 回滚点

- Model operation 与 UI 分批提交前均保持旧项目可打开；任何 Reader/Repository 失败不得发布部分状态。
- 若真实外壳影响 Designer 画布几何，先保留结构化 presentation 编辑和独立预览，不复制 Runtime overlay 状态机。
