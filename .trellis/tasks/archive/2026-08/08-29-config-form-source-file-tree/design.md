# 技术设计

## Snapshot 契约

定义只读 `ExportSnapshot`，包含 application/project identity、revision、entry 和冻结的 `Record<ProjectPath, WorkspaceFile>`。弹窗 open handler 创建 snapshot；tree、code computed 与 download handler 都闭包捕获该 snapshot，不能重新调用 reactive generator。

当前设计 revision 与 snapshot revision 不一致时显示 stale 提示和显式刷新动作。刷新生成全新对象，并在旧选择仍存在时恢复选择，否则按 entry -> 第一个文本文件 -> 第一个文件回退。

## Tree Model

`buildProjectFileTree(files)` 按 `/` 分段构造判别联合：

```ts
type ProjectTreeNode =
  | { kind: 'directory'; id: string; name: string; children: ProjectTreeNode[] }
  | { kind: 'file'; id: string; name: string; path: ProjectPath; file: WorkspaceFile }
```

构造器拒绝 path 冲突并执行目录优先、大小写稳定排序。所有节点 id 基于完整规范化路径，避免同名目录冲突。

## 组件交互

独立 `ProjectFileTree.vue` 接收 tree、selectedPath 和 expandedIds，发送 select/toggle。递归 DOM 保持 `treeitem/group` 层级；另一个 visible-node 纯函数用于 roving tabindex 和键盘导航。

ArrowRight 展开或进入首子项，ArrowLeft 折叠或回父项，上下键遍历可见节点，Home/End 跳首尾，Enter 切换目录或选择文件。焦点 class 与 `aria-selected` 分离，type-ahead 可在核心键盘契约完成后加入但不是阻断项。

## UI

文件树使用固定行高、单行省略、图标列和清晰层级 guide，避免完整路径重复展示。桌面为左树右编辑器；窄屏使用同一弹窗内的 Tree/Code segmented view，不嵌套卡片。所有按钮使用现有 icon library 与 tooltip。

## 测试

纯函数测试覆盖树构造、排序、可见节点和回退；组件测试覆盖 ARIA 与键盘；集成测试冻结 snapshot 后改变当前 revision，断言 Monaco 和 ZIP 不变；浏览器验证桌面/320px 以及亮暗主题。

