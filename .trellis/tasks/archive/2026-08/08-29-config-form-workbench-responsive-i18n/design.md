# ConfigForm 工作台移动端与国际化技术设计

## 设计原则

1. Config Model 仍是布局唯一真源；Preview 只改变可用宽度，不推断或覆写 responsive。
2. 无 responsive 的旧页面保持原语义；产品默认通过版本化内置模板改进，而不是 Runtime 隐式迁移。
3. Workbench 文案只有一份类型化目录；Designer locale contract 继续承担翻译、插值和物料本地化。
4. 国际化工具属于构建期资源工作流，浏览器运行时不接触翻译服务或密钥。

## 模板响应式数据流

```text
Built-in Profile Template
  -> DesignerDocument.form.responsive
  -> LowCodePageModel.form.responsive
  -> ConfigFormDesigner breakpoint projection
  -> compileDesignerDocument
  -> ConfigFormRenderer responsive resolver
  -> Preview viewport
```

`designerDocument()` 复用 Playground 已验证的 tablet/mobile override。responsive 是 Designer document v1 已支持的可选内容，因此 registry template 与 project/application metadata 继续使用版本 1，不把内容默认值调整误报为协议迁移。

旧工程只在用户执行 Reset 时重新从当前 registry template 生成；现有 Reset 的同版本保护保持有效。打开、保存和导出路径不注入 responsive。这样既修正新项目体验，也不会把“未配置 responsive”误判为“用户希望自动单列”。

## Locale 架构

新增 Workbench-owned locale 模块，职责如下：

- 定义 `WorkbenchLocaleId = 'en-US' | 'zh-CN'` 与类型化 key 集合；
- 提供完整英文基线和完整简体中文目录；
- 规范化浏览器/持久化 locale；
- 将 Workbench messages、当前 adapter 的 Designer messages/materials 与调用方 `DesignerLocaleOptions` 按确定优先级合并；
- 暴露带类型 key 的 translator，内部仍调用 `createDesignerLocale`，不重写插值逻辑。

优先级从低到高：

```text
English fallback
  -> selected Workbench catalog
  -> adapter Designer catalog
  -> caller messages/materials
  -> caller translate callback
```

App 持有当前语言和语言菜单状态，生成一个 effective locale options。该对象同时传给 ConfigFormDesigner、PageManager、FlowWorkspace、PreviewRuntimeBoundary、ProjectFileTree 与 WorkspaceCodeEditor。模板标题/说明通过 template id 查 Workbench 文案，不修改 registry 的稳定内部标识。FlowWorkspace 保留现有 locale 消费方式，但所有 `flow.*` key（包括 concurrency/error policy 选项标签）纳入 Workbench 目录和完整性测试。

## 语言偏好与交互

- 初始化顺序：有效持久化偏好 -> `props.locale?.locale` -> `navigator.language` -> `en-US`。
- 切换后写入 namespaced localStorage key；存储异常只影响记忆，不阻断界面。
- App watch 当前语言更新 `document.documentElement.lang`。
- 顶栏使用 lucide `Languages` 图标按钮与右对齐 menu；菜单项单行、带当前选择状态，Escape/外部点击关闭并恢复焦点。
- 移动端沿用现有顶栏收缩策略，不增加常驻文字按钮。

## 资源与国际化工具

Workbench 目录保持静态对象/JSON-compatible 形状，使现有 i18n-tool 能扫描、补齐和校验资源。生成结果必须进入代码审查和类型完整性测试；不允许在应用启动或语言切换时调用 AI。

## 测试设计

- Locale unit：locale normalization、storage failure、双目录 key parity、插值、adapter 合并和 caller override。
- Template unit：两个模板的 `form.responsive`、template metadata v1、Reset 行为与 Config/source round trip。
- Component：PageManager、FlowWorkspace、PreviewRuntimeBoundary、ProjectFileTree 与 WorkspaceCodeEditor 的中英文 visible text、aria-label、动态参数。
- Workbench shell：语言 menu 的键盘/焦点、持久化、Export/Preview/Page/Flow 的同步文案。
- Browser：desktop/tablet/mobile 的 Designer/Preview 几何一致；390px 顶栏、两个下拉菜单和三个主要弹窗；Light/Dark + en/zh。
- Export integration：Element/Ant Profile 安装、typecheck、build，确保新增 responsive 配置仍能生成合法真实工程。

## 兼容性与回滚

- 公共 Runtime 和 Designer document schema 不变，只填充已有可选字段。
- `DesignerLocaleOptions` 形状不变，调用方覆盖继续有效。
- 回滚 locale UI 只需移除 Workbench locale module/menu wiring；持久化 key 可被忽略。
- 回滚模板默认 responsive 不需要数据迁移，因为旧工程未被自动改写且模板协议版本未变化。
