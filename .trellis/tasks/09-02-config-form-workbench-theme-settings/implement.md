# ConfigForm Workbench 多主题与外观设置实施计划

## 1. 开发前

- [x] 用户批准父任务最终规划后，启动本子任务并加载 `trellis-before-dev`。
- [x] 核对 Workbench frontend 目录、状态管理、Runtime 隔离与按需 Element Plus 导入规范。
- [x] 记录现有 12 张视觉基线和两 Provider computed-style 指纹，作为变更前基准。

## 2. 偏好合同与状态

- [x] 在 `src/app/types/` 增加 appearance 类型，并从唯一 barrel 导出。
- [x] 在 `src/app/services/` 增加纯解析、默认值、storage 读写和 system resolve 服务；所有未知/损坏输入 fail closed 到默认值。
- [x] 扩展 UI store：`themePreference`、`paletteFamily`、`resolvedTheme`、设置 Drawer 状态与显式 set action。
- [x] 仅在 system 模式订阅 MediaQueryList，使用 watcher cleanup 移除监听。
- [x] 保留现有消费方所需的 Light/Dark resolved 输出，删除单一 `toggleTheme` 的 UI 入口和重复事件。

## 3. 首绘与 DOM 同步

- [x] 在 `index.html` 增加最小同步 appearance bootstrap，在应用入口前设置 html 的 `data-theme` / `data-palette`。
- [x] 让 app 根、模板根、documentElement 与 `#workbench-overlays` 同步同一 resolved 属性。
- [x] 保证 storage/key/enum/default 的 bootstrap 与 TS parser 合同由测试锁定。
- [x] 确认 RuntimeHost payload、runtime-host HTML 和 iframe CSS 无 appearance 字段或 Workbench token。

## 4. Token 与组件库桥接

- [x] 在 `shell.css` 建立四家族 × Light/Dark 的 semantic token 表。
- [x] 产品化 visible border、small-text foreground、filled action、focus 与 status token，不直接照搬低对比语法色。
- [x] 把现有 `--wb-*` 与 Element Plus `--el-*` 映射到 semantic token；在 `studio.css` 只保留设计器桥接。
- [x] 清理 Workbench 范围内与主题合同冲突的硬编码蓝色 focus/selection/action 色。

## 5. 设置 UI

- [x] 实现共享 appearance panel：`ElSegmented` 模式与带 swatch 的可访问单选 palette 列表。
- [x] 实现桌面齿轮 `ElPopover` 和移动 More -> `ElDrawer`，全部 append 到 `#workbench-overlays`。
- [x] 在设计器与模板页接入相同设置状态；移除原太阳/月亮入口。
- [x] 补齐 zh-CN/en-US 文案、Tooltip、aria-label、选中状态、Escape 与焦点恢复。
- [x] 检查粗指针 44×44 目标和长中文/英文在 390 像素下无溢出。

## 6. 验证

- [x] 增加 16 个偏好解析组合及无效/storage 异常测试。
- [x] 增加 store/system listener、bootstrap、DOM/overlay 同步与项目数据隔离测试。
- [x] 参数化 8 套 theme contract 对比度和 Runtime CSS 禁区测试。
- [x] 增加 Popover/Drawer 组件测试与 8 套实际状态 axe。
- [x] 扩展 system 模拟和两 Provider Runtime computed-style 隔离 E2E。
- [x] 更新为 8 张主题基线 + 4 张响应式/语言哨兵，并逐张人工检查。
- [x] 运行：
  - `pnpm --filter @config-form/workbench test`
  - `pnpm --filter @config-form/workbench typecheck`
  - `pnpm --filter @config-form/workbench build`
  - `pnpm --filter @config-form/workbench test:e2e`
  - `pnpm lint`
  - `git diff --check`

## 7. 评审与回滚

- [x] 独立检查 localStorage 只保存应用偏好，项目序列化/历史/导出/恢复无 appearance 字段。
- [x] 独立检查 RuntimeHost schema 和 runtime-host styles 未改变。
- [x] 若首绘、contrast 或 Runtime 隔离任一门禁失败，不启动后续设计器子任务。
