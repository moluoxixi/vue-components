# 实施计划

- [x] 扩展 pointer drag session，记录 viewport position、offset、candidate identity，并补状态机测试。
- [x] 提取幂等 drag teardown，统一所有结束路径并测试资源释放。
- [x] 增加 Overlay host 和视觉副本清理工具，禁止命中、焦点和业务事件。
- [x] 连接 Runtime candidate 注册/ResizeObserver 与 raf 调度，处理跨容器尺寸变化。
- [x] 为无合法 candidate、canvas/媒体和 candidate 暂时卸载实现稳定 fallback。
- [x] 覆盖物料拖入、已有节点排序、根/多层布局、cancel/drop/readonly/page switch/unmount。
- [x] 运行 Designer 单测、类型检查、Lint、构建与桌面/窄屏浏览器矩形验证。

## 回滚点

- drag session/teardown 与 Overlay UI 分开落地，状态机先通过测试。
- Overlay 出现兼容问题时可独立关闭，不回退真实 candidate 投影和持久化操作。
