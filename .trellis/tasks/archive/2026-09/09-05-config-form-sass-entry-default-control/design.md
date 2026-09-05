# ConfigForm Sass 入口与默认值控件收口设计

## 样式入口边界

- 发布包组件以 `style/index.scss` 作为稳定的 Sass 子路径，包级聚合入口继续 `@forward` 组件样式。
- 发布组件源码不自动导入 Sass，避免 JS 入口与手动按需入口重复加载。
- Workbench/Playground 私有组件由应用构建负责，直接导入 `./style/index.scss`。
- Workbench 的 Element Plus 动态样式清单属于 adapter 加载服务，移动到 `adapters/services/element-plus-{inspector,runtime}.ts`，不创建伪 `styles/` TypeScript barrel；文件名和 CSS chunk 名保持稳定，bundle verifier 跟随 owner 路径。

## 默认值字段边界

- `DesignerPropertyForm` 在 `propertyControls.defaultValue` 存在且 setter 声明 `valueKind` 时复用 `simpleField`。
- 未注册 default control 时仍由 `DesignerSetter` 渲染核心 `DesignerDefaultValueSetter`。
- `ElementDefaultValueSetter` 禁止 attrs 自动落到容器，并将 `id`、class 与 ARIA attrs 传给当前真实 Element Plus 控件。
- Renderer 的默认 `modelValue` / `update:modelValue` 绑定保持不变。

## 兼容与回滚

公开 Sass export 路径不改名。若消费方样式缺失，可单独回滚隐式导入移除；若默认值提交异常，可回滚 `controlFor` 的 registered-default 分支而不影响 fallback。
