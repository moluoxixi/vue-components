# ConfigForm Workbench UI 优化实施计划

## 1. 启动与顺序

- [x] 审查父任务与三个子任务的 `prd.md`、`design.md`、`implement.md`，确认没有开放产品决策。
- [x] 用户批准规划后启动主题子任务，父任务只承载集成验收。
- [x] 主题子任务完成并通过检查后，依次完成设计器和模板子任务。
- [x] 每个子任务开始编码前使用 `trellis-before-dev` 重新加载目标 package/layer 规范。

## 2. 子任务交付门禁

### 2.1 主题基础设施与设置

- [x] 完成正交偏好模型、解析、持久化、system 监听、首绘保护和共享设置 UI。
- [x] 完成 4 × 2 semantic token 与 Element Plus/Designer bridge。
- [x] 验证 overlay 同步、项目数据隔离、Runtime iframe 隔离和 8 套对比度。

### 2.2 设计器视觉精修

- [x] 在主题 token 基础上调整排版、壳层、Canvas framing 和面板层级。
- [x] 完成 900 像素四个短文字入口与 390 像素触控合同。
- [x] 验证 command、selection、drag、resize、camera 和 geometry 无回归。

### 2.3 模板创建页精修

- [x] 完成宽屏/中屏/移动主从布局和按需目录。
- [x] 完成紧凑目录元数据与加载失败、空筛选、无选择等独立状态。
- [x] 验证筛选、键盘选择、资格、preview race、创建禁用与重复提交合同。

## 3. 父任务集成验证

- [x] 运行三个子任务列出的全部单元测试、typecheck、build、bundle guard 与 E2E。
- [x] 运行 Workbench 全量 Playwright：`accessibility`、`interaction`、`json-import`、`template-management`。
- [x] 在 1440×900、900 像素和 390 像素抽查设计器与模板页的 zh/en、Light/Dark。
- [x] 确认 8 张主题基线和少量响应式/语言哨兵覆盖完整且没有重复笛卡尔截图。
- [x] 对两套 Provider 重跑 Design/Preview computed-style 指纹和真实交互。
- [x] 运行 ConfigForm 相关 package 测试、根 lint 与父任务区间 `git diff --check`。
- [x] 检查最终 diff：未包含 ProjectDocument/RuntimeHost 协议变化、第三套 UI 库、Base UI 抽象或无关格式化。

## 4. 评审与回滚点

- [x] 主题子任务提交前冻结 token 名称和 DOM 属性；后续子任务未绕过合同。
- [x] 每个子任务更新视觉基线前先人工比对布局与 Runtime 指纹，未批量接受未知回归。
- [x] 专项门禁失败均在所属页面、样式或测试 helper 内修复，未修改核心模型、Runtime 或放宽几何阈值。
- [x] 三个子任务通过后完成独立父级集成审查，并修复低于 10px 的字体与历史 Sass EOF 空行。

## 5. 实际验证（2026-09-05）

- 子任务均已归档：`theme-settings`、`designer-polish`、`template-polish`。
- Workbench：51 个测试文件、462 个单测通过；typecheck、生产 build、Element Plus bundle guard、Monaco lazy-boundary guard 通过。
- Workbench E2E：78 个 Chromium 场景通过，覆盖 accessibility、interaction、json-import、template-management、16 张视觉哨兵与双 Provider Runtime 指纹。
- Designer：19 个测试文件、84 个测试通过；Element Plus Designer adapter 5 个文件、29 个测试通过；两包 typecheck/build 通过。
- `pnpm test:config-form-packages`：14 个 ConfigForm 构建任务及公开包边界验证通过。
- `pnpm test:package-architecture`：11 个测试通过，架构诊断为 33 个包、0 条 debt。
- `pnpm lint`、当前工作树与父任务起点 `git diff --check`：通过。
