# 验证记录

## 实现范围

- 表单统一经过 Headless controller 与 ConfigFormRenderer，ConfigForm 只做插件预处理。
- 同步 model.read/write 端口直接连接宿主响应式值源，清除旧模型镜像。
- Canonical 字段与 Core 布局/校验触发规则被 Compiler、Designer、Runtime 和 Source 共同消费。
- Designer 通过 runtime/dragVisual Host 插槽和注入的 Inspector renderer 渲染，删除本地 Runtime bridge、specimen 和旧模板链路。
- 完整 slot 投影、外部 Flow 状态、动态 required、并发校验与卸载失效均有执行回归。

## 已通过

- 16 个 ConfigForm workspace 的类型检查。
- 全包构建：18 个任务成功，包含 Workbench 与 Playground。
- ConfigForm 全量单测：1032 项通过，其中 Runtime 81 项、Workbench 486 项。
- 架构测试：24 项通过；依赖图门禁检查 33 个包、0 项待清理债务。
- 公开包打包与独立 JavaScript/TypeScript 消费者检查通过。
- Element Plus 与 Ant Design Vue 的生成 Source 工程：2 项安装、类型检查和构建集成测试通过。
- Workbench Playwright：80 项通过，包含 1440px、900px、390px、两种 UI 适配器、主题截图、拖拽、Flow、模板、JSON 导入与 axe 检查。
- Playground Playwright：8 项通过，包含两套 UI 适配器、200 个字段、容器与联动场景。
- 当前 ESLint 配置下无规则错误；该配置未启用 Vue 文件检查，Vue 文件另由 vue-tsc、构建及浏览器用例验证。

## 环境说明

- 初次并行浏览器验证遇到 Vite 依赖重新优化引起的页面刷新；缓存生成后串行完整重跑 80 项全部通过，没有改动截图基线或放宽断言。
- registry 的 `@moluoxixi/zod3-to-rule@0.1.3` 被 pnpm 发布信任检查拒绝。本地集成测试改为安装当前仓库规则包的真实 `.tgz`，其余依赖继续接受正常信任检查；未修改生成工程的依赖版本声明，也未关闭 registry 信任策略。registry 发布问题不在本次本地重构中处理。

## 合并与清理

- 实现提交：`0c4b5f8b`；main 合并提交：`e94ddfbc`。
- 同步最新 main 时没有冲突；合并后的 frozen-lockfile 安装和架构门禁通过。
- main 工作区重新完成 18 个构建任务，预览地址为 `http://127.0.0.1:4360`。
- Git worktree 已注销，临时分支 `codex/config-form-architecture-rewrite` 已删除。
- 磁盘目录 `D:/project-new/vue-component.worktrees/config-form-architecture-rewrite` 已删除，`Test-Path` 确认为 `False`。先前删除被审批阻止；用户明确授权后，通过审批执行，确认相关预览进程退出并清除占用文件后完成目录清理。
- 清理后恢复 `http://127.0.0.1:4360` 预览服务，HTTP 检查返回 200。全部验收项完成。
