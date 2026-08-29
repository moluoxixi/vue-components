# ConfigForm 生产级 Low-Code IDE 验收证据

日期：2026-08-30

## 架构与功能

- Config Model / Workspace Session 是页面结构、revision 与历史的唯一业务状态源。
- Workbench 已拆为 Shell、Session、Studio、Preview、Pages、Flow、Export 与 Locale 模块；`App.vue` 仅装配宿主。
- Design Canvas、拖拽 candidate 与 Preview 复用 RuntimeSurface 和 Component Registry。
- Components 使用受控真实 Runtime specimen；拖拽虚影使用 candidate 真实 DOM clone。
- Flow 是页面事件 DAG 弹窗工作区；Config 与 Source 仅通过 Export 菜单只读查看和下载。
- Config 输出 `defineFields / defineField / defineFlow` TypeScript；Source 输出无 ConfigForm 依赖的完整 Vue 工程。

## 浏览器验收

- 1440px：稳定三栏，Preview 右侧 overlay，不改变 Canvas 几何。
- 900px：侧栏为非模态 overlay drawer，Preview 仍覆盖而不替换 Canvas。
- 390px：Components / Layers / Canvas / Inspector / Pages 五个底部入口与实际 tabpanel 一致，无横向溢出。
- 304px Inspector：普通属性为顶置单行 label + 下一行全宽 control；`Label position`、`Columns`、`Field span` 不再裁切或挤压。
- medium Inspector 打开后缩到 narrow：底部 Canvas、Designer active view 与可见 Canvas 同步。
- Preview 在移动端为全屏工作区；Source/Config 弹窗为全屏只读视图。
- 900px Preview 以实际 `.preview-stage` 宽度选择 Runtime mobile columns/span；三个字段均位于 stage 内且无横向溢出。
- Canvas 节点保持选中时打开 Preview，Designer node actions 不再穿透 Preview，真实 Element Select 可正常展开。
- Source 首次打开即显示层级文件树、`package.json`、Monaco 与可用 Project ZIP。
- 中英文 Export 菜单均保持单行；Flow 与 Page Manager 关闭后焦点回到“更多操作”触发器。
- Light/Dark 切换前后 Canvas sheet 与真实 Runtime 控件 computed style 完全一致。
- Light/Dark 主题切换不会经过低对比的卡片背景中间帧；Inspector 的 Element Plus provider 过渡与变量覆盖保持在右栏作用域。
- root `scrollWidth === clientWidth`；移动底栏按钮高度约 52.9px。
- root、末尾、Date/Time full width 与 `Section -> Card -> Flex -> Input` 三级嵌套拖拽通过；candidate、虚影、落地节点尺寸差小于 1px。

## 自动化门禁

- Core：34 tests passed；test/typecheck/build passed。
- Runtime：200 tests passed；test/typecheck/build passed。
- Designer：143 tests passed；test/typecheck/build passed。
- Element Designer：24 tests passed；test/typecheck/build passed。
- Ant Designer：17 tests passed；test/typecheck/build passed。
- Workbench：150 tests passed；test/typecheck/build passed。
- Playwright：8/8 scenarios passed；其中 2 个 axe 场景覆盖模板选择、桌面 Dark/Light、390px Inspector、Flow 弹窗与 Source 导出，均为 0 WCAG 2 A/AA violations；6 个交互场景覆盖 Element 17 个、Ant 22 个真实物料、pointer/keyboard/touch 拖放、三级嵌套、Preview 同树及紧凑 Preview hit testing。
- `pnpm lint` passed。
- `pnpm test:config-form-packages` passed，发布包边界验证通过。
- `pnpm --filter @config-form/workbench verify:templates`：4/4 passed；Element/Ant Config 工程与 standalone Source 工程均完成独立安装、typecheck、build。
- Workbench 生产构建保持 feature split：初始 shell 789.51 kB / gzip 224.09 kB；Element 与 Ant adapter、Monaco、Vue Flow、Export 均为独立动态 chunk，非当前 adapter 不进入初始加载。
- `git diff --check` passed；仅存在 Git 提示的既有 LF/CRLF 工作树转换警告，无空白错误。

## 结论

PRD AC1-AC13 已有组件测试、集成构建或真实浏览器证据，满足本任务归档条件。
