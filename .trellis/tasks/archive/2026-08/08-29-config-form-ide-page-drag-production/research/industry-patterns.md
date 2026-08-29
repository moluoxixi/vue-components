# 成熟实现调研

## Drag Overlay

来源：dnd-kit `Drag Overlay` 文档，<https://dndkit.com/legacy/api-documentation/draggable/drag-overlay/>。

可复用结论：

- Drag Overlay 应脱离正常文档流，并相对 viewport 定位；这样不会被 Canvas 的滚动容器、`overflow` 和 stacking context 截断。
- 跨容器拖拽时，源节点或目标候选可能卸载/重新挂载，Overlay 必须拥有独立生命周期，不能依赖源 DOM 始终存在。
- Overlay 容器应持续挂载，只切换内部内容；这使 drop animation 和清理过程确定。
- 拖拽行为与展示组件应解耦。对本项目而言，展示输入不是另一套 Palette Card，而是同一个 Registry candidate 的无副作用投影。
- Overlay 不能再次注册为 draggable，否则会形成嵌套 sensor 和重复事件。

本项目约束：

- 目标位置 candidate 仍由 `projectedDocument -> RuntimeSurface` 实时渲染，作为最终布局的权威预览。
- 鼠标 Overlay 放在 Canvas scroll container 之外，`position: fixed`、`pointer-events: none`、`aria-hidden: true`。
- Overlay 使用 candidate 的最新 pointer position；进入合法目标后同步已注册 candidate DOM 的实测宽高。
- 不在 Overlay 内执行事件、网络、导航、计时器或表单写入。结构物料依赖父 Provider 时，优先使用已渲染 candidate 的受控视觉快照，不能为了“真实组件”重复挂载一个缺失 Provider 的非法组件树。
- Cancel、drop、readonly 切换、项目切换和 unmount 必须在同一清理入口撤销 Overlay、候选投影和动画帧。

## 文件树与键盘模型

来源：WAI-ARIA APG `Tree View Pattern`，<https://www.w3.org/WAI/ARIA/apg/patterns/treeview/>。

必须实现的交互：

- 容器使用 `role="tree"`，节点使用 `role="treeitem"`，父节点的子项位于 `role="group"` 中。
- 只有文件夹节点拥有 `aria-expanded`；文件叶子不得错误声明展开状态。
- 单选文件树必须区分 DOM focus 与 `aria-selected`，不能用一个 hover/active class 混合表达。
- `ArrowRight` 展开文件夹或进入第一个子项；`ArrowLeft` 折叠或返回父项；上下键遍历当前可见节点。
- `Home`/`End` 跳转到第一个/最后一个可见节点，`Enter` 激活文件或切换文件夹，推荐支持 type-ahead。
- 当前文件被重新生成但仍存在时应保持选择；文件消失时使用确定性 fallback，而不是留下指向不存在 path 的 Monaco model。

## 多页面低代码模型

来源：GrapesJS `Pages` 模块，<https://grapesjs.com/docs/modules/Pages.html>。

可复用结论：

- 多页面是 Project 内的一等集合；即使用户只使用单页，底层仍保留一个默认 Page，保证 API 和迁移路径一致。
- Page Manager 提供 `getAll/getSelected/add/select/remove` 等稳定操作，UI 只是该模型的投影。
- 旧单页 `components/styles` 初始化会迁移到 Page Manager 的默认 Page，而不是继续维护两套并行真源。
- Page 内容变化与 Page 集合变化是不同事件边界；本项目同样应区分 Page Model history 与 Application Page operations/revision。

对本项目的推荐映射：

```text
WorkspaceApplication
  -> pages[]
       -> page metadata (id/name/route/home/order)
       -> LowCodePageModel
  -> shared adapter/dependencies/assets/template metadata
```

编辑器一次只投影一个 Page；左侧 Pages 和页面管理界面都调用同一个 Application Page reducer。旧 v1 Project 迁移为只含一个默认 Page 的 v2 Application。
