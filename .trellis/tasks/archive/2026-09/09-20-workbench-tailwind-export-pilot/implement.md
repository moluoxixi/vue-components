# 实施计划

## 1. 接入构建基础设施

- [x] 为 Workbench 增加 Tailwind CSS v4 与官方 Vite 插件依赖。
- [x] 在 Workbench Vite 配置中注册 Tailwind 插件。
- [x] 新增无 Preflight、精确扫描的 Tailwind 样式入口，并接入同步样式清单。
- [x] 建立基于现有 `--wb-*` 的语义 color/shadow token。

## 2. 迁移 Export Dialog 试点

- [x] 将 Workbench 自有 DOM 的普通布局、尺寸、间距和颜色迁入 utility class。
- [x] 保留稳定语义类名与 Element Plus 内部结构、复杂状态、媒体规则。
- [x] 删除 CSS 中被 utility 接管的重复声明。
- [x] 不修改导出业务逻辑或 Source Viewer 包。

## 3. 更新合同测试

- [x] 更新主题/样式合同测试，覆盖插件、无 Preflight、精确扫描、token 映射和职责边界。
- [x] 保留 Export Dialog 功能测试并补充必要的样式生效断言。
- [x] 检查 Runtime Host 不受 Workbench Tailwind 入口影响。

## 4. 验证

依次运行：

```sh
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
```

最终检查构建产物、浏览器错误、桌面与移动端 Export Dialog、主题切换和无障碍结果。

## 验证记录

- Workbench 单测：45 个文件、546 项测试通过。
- TypeScript：`pnpm --filter @config-form/workbench typecheck` 通过。
- 生产构建：通过，Tailwind 产物门禁确认语义 utility 存在、无 Preflight 残留且 Runtime Host 未被污染。
- Export Dialog 专项 E2E：桌面 `1120x800` 与移动端 `390x844` 通过，无横向溢出。
- 双 Provider 移动端无障碍：2 项通过；8 组 palette/theme token 校验全部通过。
- 全量 E2E：44/78 通过；34 项失败均属于任务前既有类别，其中 18 项为旧模板、导航或 Preview 断言，16 项为缺失 Windows 截图基线。新增 Tailwind Export 布局与 8 组 palette/theme token 用例均通过。
- ESLint 与 `git diff --check` 通过。
- 全仓 package architecture 仍有 27 条既有非 ConfigForm 诊断；ConfigForm 架构用例 7/7 通过。
- frozen lockfile 校验通过。

## 风险文件与停止条件

- `src/styles/index.css` 是同步级联清单，导入顺序变化必须通过样式合同测试。
- `vite.config.ts` 同时构建主应用和 Runtime Host，不能让共享配置误变成共享 CSS 导入。
- `features/export/style/index.css` 的未分层声明会覆盖 Tailwind layer；发现重复所有权时先删除重复规则，再判断 utility 是否生效。
- 若迁移需要修改 ProjectDocument、Compiler、Runtime Host、Provider 或 Source Viewer，停止并拆分后续任务，不扩大本期范围。
