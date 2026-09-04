# ConfigForm Workbench 多主题与外观设置技术设计

## 1. 状态模型

新增正交状态，保留现有 resolved 输出：

```ts
type WorkbenchThemePreference = 'system' | 'light' | 'dark'
type WorkbenchResolvedTheme = 'light' | 'dark'
type WorkbenchPaletteFamily = 'catppuccin' | 'kanagawa' | 'gruvbox' | 'rose-pine'

interface WorkbenchAppearancePreference {
  version: 1
  themePreference: WorkbenchThemePreference
  paletteFamily: WorkbenchPaletteFamily
}
```

- `themePreference` 默认 `system`，`paletteFamily` 默认 `catppuccin`。
- `resolvedTheme` 由 preference 与 `matchMedia('(prefers-color-scheme: dark)')` 计算，继续满足现有只接受 Light/Dark 的组件和 CSS。
- UI store 是唯一状态所有者；建议在 `src/app/types/appearance.ts` 声明合同，在 `src/app/services/appearance-preference.ts` 集中解析、读写、默认值和 system 解析。
- 不扩展 `ProjectDocument.settings`，不调用 Project Repository、History 或 Recovery。

## 2. 持久化与首绘

### 2.1 当前格式

- 使用独立 key：`moluoxixi.config-form.workbench.appearance`。
- 只接受完整、精确的 `version: 1` 对象与已知枚举；未知版本、缺字段、额外语义无法识别、损坏 JSON 或 storage 异常均回退默认值。
- 当前没有旧主题记录，因此不提供迁移、别名或兼容 reader；Locale 现有 key 和格式保持不变。

### 2.2 无闪烁启动

`index.html` 在应用入口和 Workbench CSS 生效前执行最小同步 bootstrap：读取当前 key、校验已知字面量、解析 system，并把 `data-theme`、`data-palette` 写到 `document.documentElement`。Vue store 挂载后重新用正式 parser 校验，并同步应用根、模板根和 `#workbench-overlays`。

早期脚本与 TypeScript parser 的 storage key、默认值和枚举由 contract test 比对，防止两份字面量漂移。overlay 通过 document 根继承初始 token，挂载后再获得显式属性，因此无需把脚本或 theme 字段传入 iframe。

## 3. System 监听生命周期

- 仅在 `themePreference === 'system'` 时订阅 MediaQueryList `change`。
- 切换到显式 Light/Dark 时立即移除监听并保持 resolved 值稳定。
- 切回 system 时用当前 `matches` 重新解析后再订阅。
- watcher 使用清理回调，防止热重载或 store 销毁留下重复监听。

## 4. DOM 与 CSS 合同

```text
appearance preference
  -> UI store
  -> resolvedTheme + paletteFamily
  -> html / .workbench-app / .template-creation-workspace / #workbench-overlays
  -> semantic --wb-* tokens
  -> Element Plus --el-* bridge + Designer --mx-designer-* bridge
```

- DOM 属性固定为 `data-theme="light|dark"` 与 `data-palette="..."`。
- `src/styles/shell.css` 拥有 8 套基础 semantic token；`studio.css` 只桥接设计器语义，不复制 palette。
- 核心 token 至少包含：workspace、panel、elevated、control、line、text、muted、accent、accent-hover、accent-foreground、focus、action、action-foreground、success/warning/danger foreground 与 surface。
- 每套 Light/Dark 使用独立的 visible border 与小号文字色。编辑器 palette 中低于 4.5:1 的 accent/status 只可作为图标、色条或带底色装饰，不能直接作为小号正文。
- Element Plus 变量桥只作用于上述 Workbench 根与 overlay。Runtime document 不加载 `shell.css`，RuntimeHost message schema 不增加主题字段。

## 5. 设置界面

### 5.1 共享内容

新增一个共享设置内容组件，模式用 `ElSegmented`，配色用单选列表。每项显示名称、Light/Dark 色板 swatch、当前选中状态和可访问名称；选择即调用 store action 并持久化。

### 5.2 响应式容器

- 桌面：顶栏齿轮按钮触发 `ElPopover`，内容紧凑、不使用嵌套卡片。
- 移动：More 菜单发出“外观设置”命令，根级 `ElDrawer` 承载同一个设置内容。
- 设计器顶栏和模板页顶栏复用入口与文案；移除现有太阳/月亮直接切换入口。
- Popover/Drawer 继续 append 到 `#workbench-overlays`，保留 Escape、点击外部关闭、焦点恢复和 44×44 粗指针目标。

建议组件边界：

```text
app/components/
  WorkbenchAppearancePanel.vue      # 共享字段与选项
  WorkbenchAppearancePopover.vue    # 桌面触发器
  WorkbenchAppearanceDrawer.vue     # 移动容器
```

不创建通用 Base UI 层；这些组件只属于 Workbench 外观功能。

## 6. 国际化

为设置标题、system/light/dark、四个 palette、打开/关闭以及无保存说明补充 zh-CN/en-US 文案。Palette 产品名保留原名，辅助文本本地化。不得用可见说明文字解释键盘快捷键或视觉实现。

## 7. 测试设计

- Parser：8 个显式模式组合 + 8 个 system/OS 组合，共 16 个解析案例，并覆盖损坏 JSON、未知枚举、未知版本、storage throw。
- Store：监听注册/清理、显式模式屏蔽系统变化、root/template/overlay 同步、刷新恢复和项目数据无主题字段。
- Bootstrap：同步脚本在 Vue mount 前产生正确 html 属性，且与正式 parser 的 key/default/enum 合同一致。
- CSS：4 palette × 2 resolved theme 共 8 套 token 参数化对比度；保留 Runtime provider rule 禁区。
- Component：Popover 与 Drawer 的键盘/触屏选择、Escape、焦点恢复、当前项 aria 状态。
- E2E：8 套 axe；system Light/Dark 模拟；两 provider 的 Design/Preview computed-style 指纹在 palette/theme 切换前后不变。
- Visual：8 张 1440/en 主题基线 + 4 张分配到 900/390、zh/en、Light/Dark 的响应式哨兵。

## 8. 回滚边界

主题状态、设置组件和 CSS token 可作为一个子任务整体回滚。回滚不修改 localStorage 中的未知新 key也不会影响项目数据；旧代码不会读取该 key。禁止为回滚便利增加 ProjectDocument 字段或 Runtime 兼容分支。
