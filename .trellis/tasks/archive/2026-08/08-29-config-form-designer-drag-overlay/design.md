# 技术设计

## 权威视觉来源

落点 candidate 仍由 `DesignerCanvas` 将当前 drag command 应用到临时 document，再交给设计模式 `RuntimeSurface` 渲染。该 DOM 是最终位置和容器约束的权威来源。

drag session 扩展为保存最新 viewport 坐标、源节点相对指针偏移、输入类型和 candidate identity。pointer move 只更新 transient state，不产生持久化 operation。

## Overlay

新增持续挂载的 Overlay host，位于 Canvas scroll container 之外。Overlay 使用 fixed 定位、`pointer-events: none`、`aria-hidden: true`、受控透明度和轻量阴影，尺寸来自 candidate DOM 的 `getBoundingClientRect`/`ResizeObserver`。

为避免把真实业务组件挂载两次并触发副作用，Overlay 使用已渲染 candidate DOM 的受控视觉副本。复制时移除 id、表单 name、tabindex、事件相关可交互能力和编辑桥 metadata；canvas/异步媒体无法稳定复制时显示同尺寸的 material preview fallback。Overlay 不注册为 draggable 或 Runtime node。

## 生命周期

candidate 注册、尺寸变化和指针变化合并到单个 `requestAnimationFrame` 更新，避免高频 layout thrash。所有结束路径调用一个幂等 teardown：释放 pointer capture、取消 raf、断开 observer、清空 candidate projection 和 Overlay state。

页面切换由上层销毁或 reset Designer drag controller，必须覆盖测试。键盘 drag session 不创建 Overlay host 内容。

## 验证策略

纯函数测试覆盖坐标/offset/teardown；组件测试覆盖 candidate 切换和副作用拦截；浏览器测试对 Overlay rect、candidate rect、drop 后 rect 做误差阈值比较，并覆盖 Element Plus/Ant Design Vue 全物料矩阵与多层容器。

