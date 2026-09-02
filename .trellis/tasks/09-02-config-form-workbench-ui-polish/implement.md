# ConfigForm Workbench UI 优化实施计划

## 1. 启动与顺序

- [ ] 审查父任务与三个子任务的 `prd.md`、`design.md`、`implement.md`，确认没有开放产品决策。
- [ ] 仅在用户批准本轮最终规划后启动 `09-02-config-form-workbench-theme-settings`；不启动父任务。
- [ ] 主题子任务完成并通过检查后，依次启动设计器和模板子任务。
- [ ] 每个子任务开始编码前使用 `trellis-before-dev` 重新加载目标 package/layer 规范。

## 2. 子任务交付门禁

### 2.1 主题基础设施与设置

- [ ] 完成正交偏好模型、解析、持久化、system 监听、首绘保护和共享设置 UI。
- [ ] 完成 4 × 2 semantic token 与 Element Plus/Designer bridge。
- [ ] 验证 overlay 同步、项目数据隔离、Runtime iframe 隔离和 8 套对比度。

### 2.2 设计器视觉精修

- [ ] 在主题 token 基础上调整排版、壳层、Canvas framing 和面板层级。
- [ ] 完成 900 像素四个短文字入口与 390 像素触控合同。
- [ ] 验证 command、selection、drag、resize、camera 和 geometry 无回归。

### 2.3 模板创建页精修

- [ ] 完成宽屏/中屏/移动主从布局和按需目录。
- [ ] 完成紧凑目录元数据与加载失败、空筛选、无选择等独立状态。
- [ ] 验证筛选、键盘选择、资格、preview race、创建禁用与重复提交合同。

## 3. 父任务集成验证

- [ ] 运行三个子任务列出的全部单元测试、typecheck、build、bundle guard 与 E2E。
- [ ] 运行 Workbench 全量 Playwright：`accessibility`、`interaction`、`json-import`、`template-management`。
- [ ] 在 1440×900、900 像素和 390 像素抽查设计器与模板页的 zh/en、Light/Dark。
- [ ] 确认 8 张主题基线和 4 张响应式/语言哨兵覆盖完整且没有重复笛卡尔截图。
- [ ] 对两套 Provider 重跑 Design/Preview computed-style 指纹和真实交互。
- [ ] 运行 ConfigForm 相关 package 测试、根 lint 与 `git diff --check`。
- [ ] 检查最终 diff：不得包含 ProjectDocument/RuntimeHost 协议变化、第三套 UI 库、Base UI 抽象或无关格式化。

## 4. 评审与回滚点

- [ ] 主题子任务提交前冻结 token 名称和 DOM 属性；后续子任务不得绕过合同。
- [ ] 每个子任务更新视觉基线前先人工比对布局与 Runtime 指纹，不能用批量接受快照掩盖回归。
- [ ] 若某个子任务专项门禁失败，只回滚该子任务的页面/样式改动；不得通过修改核心模型、Runtime 或放宽几何阈值兜底。
- [ ] 三个子任务通过后，父任务完成一次独立集成审查并记录残余风险。
