# 实施计划

## 顺序

- [x] 1. 完成子任务 `08-29-config-form-workbench-multipage`：v2 Application 类型、schema、migration、repository、operation、Workbench Pages/Page Manager 和多页面导出输入。
- [x] 2. 验证 v1/v2 repository round-trip、冲突提交、页面操作不变量、页面切换保护与多页面 Source 工程构建。
- [x] 3. 完成子任务 `08-29-config-form-source-file-tree`：不可变 ExportSnapshot、tree builder、ARIA Tree UI、Monaco/ZIP 统一读取。
- [x] 4. 验证文件树排序、键盘、选择回退、快照过期和窄屏弹窗。
- [x] 5. 完成子任务 `08-29-config-form-designer-drag-overlay`：pointer session、真实 candidate 视觉副本、Overlay portal 与统一清理。
- [x] 6. 覆盖物料/已有节点、根/多层容器、不同宽度、取消/提交/页面切换、触控板高频移动和只读切换。
- [x] 7. 执行父任务全量集成检查，确认三个子任务共享契约没有回退。

## 质量门

- [x] 对所有 Application schema 和 operation 做纯函数单测，包括非法输入和最后页面约束。
- [x] 对 Memory/IndexedDB repository 做 v1 migration、v2 保存重开、revision conflict 测试。
- [x] 对生成的每个 Source fixture 执行 Vue SFC 解析、TypeScript 类型检查和生产构建。
- [x] 对文件树做 builder 单测、组件键盘/ARIA 测试和 snapshot 一致性测试。
- [x] 对 drag session/controller 做 pointer 坐标、候选变化、teardown 单测；对 Overlay 做浏览器像素/矩形对比。
- [x] 运行 Designer、Runtime、Workbench 相关 lint、typecheck、unit/integration test 和 build。
- [x] 运行 `git diff --check`，并检查 Core/Runtime 未新增对 Designer/Workbench/Vue Flow 的 import。
- [x] 使用浏览器验证桌面与窄屏、亮色与暗色；画布 Runtime 保持浅色原始主题，IDE chrome 可随主题变化。

## 集成验收场景

- [x] 打开 legacy v1 项目 -> 自动成为单页 Application -> 新建第二页 -> 重命名/排序/设首页 -> 保存 -> 刷新后状态一致。
- [x] 在第二页制造未保存修改，使用左侧 Pages 切换，确认保护逻辑与 history 隔离。
- [x] 导出 Source，文件树展示全部页面；选择文件内容与 ZIP 对应文件逐字节一致，导出工程可安装并构建。
- [x] 从 Palette 向三层嵌套布局拖入各类物料，Overlay 与落点 candidate 同尺寸，提交后无跳变。
- [x] 拖动已有节点跨容器排序并取消，原模型、DOM、选择和预览不变。

## 回滚点

- Application migration 与默认写入是首个高风险点；未通过 round-trip 前不接入 App。
- 多页面 Generator 是第二个高风险点；未通过独立工程构建前不替换下载入口。
- Overlay 仅消费 transient drag state；若浏览器矩形验证失败，可回滚 Overlay 而不影响 candidate 投影和 Model 操作。
