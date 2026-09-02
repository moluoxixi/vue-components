# ConfigForm Workbench 多主题与外观设置

## 目标

为 ConfigForm Workbench 增加完整的应用级外观设置，使用户可以独立选择明暗模式与社区配色家族，并在桌面和移动端获得即时、持久、无闪烁且不影响真实 Runtime 的主题体验。

## 上下文

- 父任务：`09-02-config-form-workbench-ui-polish`。
- 当前主题由全局 UI store 拥有，但只支持内存中的 `dark | light` 二元切换；没有系统监听、持久化或设置 UI。
- Workbench、模板创建页和 `#workbench-overlays` 必须同步；Design/Preview Runtime iframe 必须继续固定为 Provider 自己的真实样式。

## 需求

1. 明暗模式支持 `system | light | dark`，默认 `system`；`system` 实时响应 `prefers-color-scheme`，显式模式忽略系统变化。
2. 配色家族支持 Catppuccin、Kanagawa、Gruvbox、Rosé Pine，默认 Catppuccin；每套均有产品化的 Light/Dark token。
3. 模式与配色作为全局应用偏好持久化在当前浏览器，作用于所有项目，不进入 ProjectDocument、版本历史、导出或恢复数据。
4. 桌面顶栏齿轮打开 Element Plus Popover；移动端从 More 菜单打开 Element Plus Drawer。两者共享同一设置内容、状态和本地化文案。
5. 模式使用分段控件，配色使用带可视色板与可访问名称的单选列表；选择即时生效并持久化，不需要保存按钮。
6. 合法已保存值优先；首次访问、缺失值、未知值、损坏 JSON 或 storage 不可用时安全回退到 `system + catppuccin`。
7. 首次绘制前解析偏好和系统模式，避免先显示固定 Dark 或其他主题再闪烁。
8. Workbench 根、模板创建页、所有父文档 overlay 与 Element Plus 变量桥使用同一解析结果；Runtime iframe 不接收 Workbench 主题。
9. 四套主题的来源、Light/Dark 配对和产品化修正可追溯；小号文字、边界、焦点和填充按钮满足 WCAG 对比要求。

## 验收标准

- [ ] 12 组偏好组合都可选择和恢复；`system` 在模拟系统 Light/Dark 变化时实时解析，显式模式保持稳定。
- [ ] 桌面 Popover 与移动 Drawer 可通过鼠标、键盘和触屏操作，当前模式/配色清晰，Escape 与焦点恢复正确。
- [ ] 刷新、新项目和项目切换均保持全局偏好；项目序列化、历史、导出和恢复结果无主题字段。
- [ ] Workbench、模板创建页和 `#workbench-overlays` 的 `data-theme` / `data-palette` 与解析结果一致，无首绘主题闪烁。
- [ ] 8 个实际视觉状态通过主题 contract 与 axe；两套 Provider 的 Design/Preview computed-style 指纹在所有壳主题切换前后不变。
- [ ] 视觉基线覆盖 4 配色 × 2 resolved scheme，并以少量 900/390、中英文哨兵避免重复笛卡尔截图。
- [ ] Workbench 单测、typecheck、build、Element Plus bundle guard、E2E、根 lint 与 `git diff --check` 通过。

## 范围外

- 自定义取色器、用户编辑任意 token、主题导入导出或云同步。
- 项目级主题覆盖、Runtime Provider 主题切换或导出应用主题。
- 新增第三套通用 UI 组件库。
