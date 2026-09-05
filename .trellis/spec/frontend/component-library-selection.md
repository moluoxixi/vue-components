# 成熟组件库优先合同

## 1. 适用范围与触发条件

本合同适用于仓库内所有前端界面。新增、替换或修复下列通用交互原语时
必须执行：Input、Textarea、InputNumber、Tooltip、Popover、Select、Combobox、
Dropdown、Menu、Dialog、Drawer、Tabs、Tree、DatePicker、ColorPicker、Toast、
虚拟列表和拖拽排序。

目标是复用经过维护和真实使用验证的交互状态机，避免项目自行承担浮层定位、
键盘导航、焦点恢复、触屏行为和无障碍语义中的重复缺陷。

## 2. 选型顺序

按以下顺序选择实现，只有前一项不能满足已确认需求时才进入后一项：

1. 目标包已经采用的成熟组件库或设计系统。
2. 仓库内基于成熟库构建且仍在维护的共享组件。
3. 经评估后引入与当前技术栈兼容的成熟库。
4. 浏览器或框架原生控件能够完整满足交互与视觉要求时使用原生控件。
5. 仅当以上方案均存在可复现的能力缺口时，才允许自定义交互状态机。

“成熟”至少意味着：有持续维护记录、稳定公开 API、明确许可证，并对目标
交互提供键盘、焦点、ARIA、浮层碰撞或移动端行为。下载量或社区热度不能单独
证明适用性。

## 3. 实现合同

- 开始实现前搜索目标包的 `package.json`、现有组件导入和仓库共享组件，记录
  已有候选。不得先手写完成再补做选型说明。
- 使用组件库的公开 API 和扩展点，不复制或绕开它的焦点、键盘、开关状态、
  Portal/Teleport、点击外部关闭及浮层定位状态机。
- Tooltip、Popover 和菜单默认由成熟库负责 hover/focus/touch 触发、显示隐藏、
  屏幕边界碰撞与销毁清理；Select/Combobox 默认由成熟库负责选中、搜索、键盘
  移动和无障碍关系。
- 当目标应用已经选定成熟组件库时，用户可编辑的 Input、Textarea 和
  InputNumber 必须使用该库的对应组件，统一继承尺寸、禁用态、校验态、主题
  token 和 focus ring。不得在同一 Inspector/Form 中混用原生输入框，再通过
  feature CSS 仿造组件库边框和聚焦样式。框架无关底层包允许保留显式的原生
  fallback，但必须集中管理样式、可访问性与回归测试，且不能泄漏到已绑定
  Provider 的应用层。
- 一个交互触发器只能由一个 overlay primitive 拥有。Dropdown、Popover、Menu、
  Select 或其他 disclosure 组件的 trigger 不得再被 Tooltip 包裹，也不得把同一
  按钮同时注册给两个浮层；部分成熟库会在 Tooltip 销毁时清理
  `aria-haspopup`、`aria-controls` 或 `aria-expanded`，从而破坏真正浮层的合同。
- disclosure trigger 的命令说明、禁用原因或快捷键应优先合并进该浮层的内容；
  无法显示浮层时写入同一按钮的可访问名称，并可用原生 `title` 作为非关键补充。
  只有不拥有展开状态的普通命令按钮才单独使用 Tooltip。
- 视觉适配通过主题 token、受控 class、slot 或官方配置完成。不要为了改样式
  退回手写交互，也不要用全局选择器破坏组件库内部状态。
- 仅当多个真实调用方需要一致的业务默认值或平台集成时才封装组件库；不得
  创建只转发 props 的通用 Base 组件层。
- 自定义实现必须在当前任务的 `design.md` 或等价设计记录中列出已评估候选、
  每个候选的可复现阻塞点、最小自定义边界、维护责任和回滚方案。
- 发现自定义组件的缺陷时，若成熟库已提供满足要求的等价能力，优先替换为
  成熟库实现；不要继续叠加补丁维护重复状态机。

## 4. 验证与异常矩阵

| 条件 | 必须结果 |
| --- | --- |
| 当前包已有成熟组件满足需求 | 复用它；拒绝平行手写实现 |
| 已绑定组件库的表单/Inspector 出现原生 Input/Textarea/Select | 替换为组件库控件，并增加生产模板静态门禁 |
| 仓库共享组件满足需求且依赖方向合法 | 复用共享组件，不复制源码 |
| 候选库缺少必要无障碍或移动端行为 | 评估下一个候选或限定自定义边界，不静默降级 |
| 引入新依赖会显著增加包体或破坏 SSR | 记录数据并选择已有库、按需加载方案或原生控件 |
| 需求只能通过组件库公开扩展点完成 | 使用扩展点，并测试集成行为 |
| trigger 已由 Dropdown/Popover/Menu 等浮层拥有 | 不再嵌套 Tooltip；说明合入现有浮层或 trigger 的可访问名称 |
| 所有候选均有已核实的能力缺口 | 允许最小自定义实现，并执行完整等价测试 |
| 仅因视觉定制或 API 不熟悉而拒绝成熟库 | 视为无效例外，返回组件库方案 |

## 5. Good / Base / Bad

- Good：目标包已经使用 Element Plus，设置入口直接使用 `ElTooltip`、
  `ElPopover`、`ElSelect` 和 `ElDrawer`，只通过 token 与 slot 适配视觉。
- Good：Provider 专属界面沿用该 Provider 的成熟组件库，宿主层不复制一套
  Select 或 Menu 状态机。
- Base：简单静态说明没有浮层和交互状态，直接使用语义化 HTML 文本。
- Bad：用 `mouseenter`、绝对定位和定时器手写 Tooltip，再逐个修补滚动、触屏、
  Escape、Teleport、边界碰撞和卸载清理。
- Bad：因为现有组件默认样式不完全一致，就用 `div` 和点击事件重做 Select、
  Dialog 或 Dropdown。
- Bad：同一 Inspector 的 Select/InputNumber 使用 Element Plus，却给名称字段
  使用原生 `input` 并单独维护 border/focus CSS。
- Bad：在 `ElDropdown`、`ElPopover` 或自定义 disclosure trigger 外再套
  `ElTooltip`，让两个浮层同时写入并清理同一组 ARIA 属性。

## 6. 必需测试

- 组件测试覆盖打开、选择、关闭、受控值同步、禁用态和销毁清理。
- 键盘测试覆盖适用的 Tab、方向键、Enter/Space、Escape，并断言关闭后的焦点
  恢复到稳定触发器。
- 浮层测试覆盖 Portal/Teleport 目标、滚动与视口边界、点击外部关闭，以及父级
  Dialog/Drawer 中的叠层行为。
- 响应式测试至少覆盖桌面键鼠和粗指针移动端，不用 hover 作为唯一入口。
- 无障碍测试断言可访问名称、角色、展开/选中关系，并运行真实浏览器 axe 门禁。
- 组合浮层回归测试必须在打开、关闭、Escape、点击外部和组件卸载后断言
  `aria-haspopup`、`aria-controls`、`aria-expanded` 仍由正确的 overlay primitive
  管理，且不会被另一个浮层清理。
- 回归测试必须调用真实组件行为；仅检查源码包含某个组件名、CSS 文本或静态
  快照，不能证明交互合同成立。
- 已绑定单一组件库的应用包应增加生产模板静态门禁，拒绝新增原生
  `input`/`textarea`/`select`；组件测试和浏览器测试仍需验证真实组件 wrapper、
  聚焦与主题行为，静态门禁不能替代交互测试。
- 自定义实现除上述测试外，还必须覆盖设计记录中的每个候选能力缺口。

## 7. Wrong vs Correct

Wrong：复制成熟库已有的 Tooltip 状态机。

```vue
<button @mouseenter="visible = true" @mouseleave="visible = false">
  Save
</button>
<div v-if="visible" class="tooltip">
  Save project
</div>
```

Correct：使用目标包既有成熟组件库，并保留真实按钮语义。

```vue
<ElTooltip content="Save project" placement="bottom">
  <button type="button" aria-label="Save project">
    <Save aria-hidden="true" />
  </button>
</ElTooltip>
```

若 `ElTooltip` 无法满足一个已确认的特殊需求，应先尝试它的 virtual trigger、
teleported、popper class 等公开能力；只有记录并复现这些能力仍不足后，才能实现
缺失的最小适配层。

Wrong：让 Tooltip 和 Dropdown 共同拥有一个 trigger。

```vue
<ElTooltip content="More actions">
  <ElDropdown>
    <button type="button">More</button>
  </ElDropdown>
</ElTooltip>
```

Correct：Dropdown 单独拥有 trigger，说明合并到菜单或按钮的可访问名称。

```vue
<ElDropdown>
  <button type="button" aria-label="More actions">
    More
  </button>
</ElDropdown>
```
