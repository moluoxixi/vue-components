# ConfigForm Workbench UI 优化技术设计

## 1. 任务边界

父任务是集成与验收边界，不直接修改产品代码。三个子任务分别拥有外观基础设施、设计器精修、模板页精修，按以下依赖顺序交付：

```text
theme-settings
  -> semantic appearance contract
  -> designer-polish
  -> template-polish
  -> parent integration review
```

主题子任务先建立稳定 token 和状态协议，后两个子任务只消费语义变量，不各自发明 palette 或持久化逻辑。

## 2. 共享架构合同

### 2.1 状态边界

- `themePreference` 与 `paletteFamily` 由唯一 Workbench UI store 拥有。
- `resolvedTheme: 'light' | 'dark'` 保留为现有组件、DOM 和 CSS 的兼容输出。
- 主题偏好只进入经过校验的 localStorage 记录，不进入 ProjectDocument、Repository、History、Checkpoint、Recovery、Export 或 RuntimeHost 协议。
- Workbench 根、模板页和 `#workbench-overlays` 使用 `data-theme` + `data-palette`。独立 Runtime document 不加载 Workbench shell CSS，也不接收这些字段。

### 2.2 视觉边界

- palette 原色先映射为产品语义 token，再桥接到 `--wb-*`、Element Plus `--el-*` 和设计器 `--mx-designer-*`。
- 组件只能消费语义 token，不直接消费编辑器语法色名或在局部硬编码品牌色。
- `line/control-border/focus/action-foreground/status-foreground` 是独立 token；不能使用低对比相邻 surface 色或未经验证的 Light accent 文字色。
- Element Plus 只用于 Workbench chrome。Designer 核心和 Runtime provider 依赖边界不变。

### 2.3 交互边界

- 保留既有 command emit、快捷键、disabled reason、roving focus、overlay append-to 与焦点恢复合同。
- 响应式调整只改变呈现和可发现性，不改变命令、模板选择、资格检查、预览或创建事务语义。
- 所有父文档浮层继续挂载到 `#workbench-overlays`。

## 3. 主题来源与配对

| 家族 | Light | Dark | 产品语气 |
| --- | --- | --- | --- |
| Catppuccin | Latte | Mocha | 默认，柔和但层次明确 |
| Kanagawa | Lotus | Wave | 灰墨与朱红 |
| Gruvbox | Light Medium Material | Dark Medium Material | 暖中性与紫棕强调 |
| Rosé Pine | Dawn | Main | 灰粉与玫瑰强调 |

官方来源：Catppuccin `palette.json`、Kanagawa `colors.lua`、Gruvbox Material `gruvbox_material.vim`、Rosé Pine `palette.lua`。社区安装量只决定候选优先级；最终颜色必须通过本仓库 contrast contract 和真实控件 axe 检查。

## 4. 子任务集成点

### 4.1 外观设置 -> 设计器

设计器只读取最终 CSS 变量和 `resolvedTheme`。Canvas 宿主可改变背景、边界与阴影，但 iframe viewport、缩放、测量、selection overlay 和 drag geometry 不变。

### 4.2 外观设置 -> 模板页

模板页根节点与 overlay 使用同一外观属性。中屏目录 Drawer 和移动端设置 Drawer 复用 overlay 容器，但通过独立可见状态避免嵌套 Drawer。

### 4.3 设计器 <-> 模板页

二者共享排版、控件高度、边界、focus ring 和状态 token，不共享页面专用布局组件。避免为了“统一”引入跨页面 Base UI 抽象。

## 5. 兼容性与回滚

- 当前没有主题持久化记录，因此新偏好格式采用唯一当前版本；未知或损坏值直接回退，不实现迁移链。
- 保留 `resolvedTheme` 可以限制现有 prop 和测试的变化面；移除的是单一 `toggleTheme` UI，而不是内部 light/dark 输出。
- 每个子任务独立提交和验证。出现主题基础设施问题时先回滚该子任务；设计器/模板视觉问题可分别回滚，不触碰 Runtime 或 ProjectDocument。
- 不接受通过修改 Runtime computed style、扩大几何容差或删除交互断言来使视觉测试通过。

## 6. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| Light palette 原色对比不足 | 专门产品化 foreground/action/border token，并参数化 8 套 contrast 测试 |
| 主题首绘闪烁 | CSS 加载/应用挂载前同步解析偏好，store 复用同一合法值合同 |
| overlay 与页面主题不同步 | 单一 store watcher 同步 document/root/template/overlay 属性 |
| palette 矩阵导致视觉基线爆炸 | 8 张实际主题基线 + 4 张响应式/语言哨兵 |
| 900 像素命令文字挤压 Canvas | 仅四个高频入口显示短文字，其余继续收纳 |
| 模板 Drawer 破坏键盘选择 | 复用现有 listbox/roving focus，并增加打开/关闭焦点恢复测试 |
| 壳层主题泄漏到 Runtime | RuntimeHost 协议保持无 theme 字段，按两 provider 验证 computed-style 指纹 |

## 7. 集成完成条件

三个子任务均完成专项验证后，父任务执行一次跨页面、跨 viewport、跨语言、跨 provider 的最终回归。父任务不通过新增兼容层解决子任务冲突；冲突返回拥有该合同的子任务修正。
