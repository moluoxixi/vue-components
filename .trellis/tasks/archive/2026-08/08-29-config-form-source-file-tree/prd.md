# Source 导出层级文件树

## 目标

把 Source 导出预览从完整路径平铺列表升级为 VS Code 风格的可访问层级文件树，并保证文件树、Monaco 和 ZIP 始终查看同一不可变导出 revision。

## 需求

- 从规范化 `ProjectPath` 纯构造 directory/file 层级，不从 DOM 或 Monaco 反推结构。
- 文件夹支持展开/折叠；同层目录优先、名称稳定排序，文件类型有清晰图标。
- DOM 使用 `tree/treeitem/group` 语义，文件夹才拥有 `aria-expanded`；焦点、选择、展开状态相互独立。
- 支持 ArrowUp/Down/Left/Right、Home、End、Enter 和 roving tabindex，鼠标与键盘结果一致。
- 选择文本文件后右侧只读 Monaco 显示相同 snapshot 内容；二进制文件提供非编辑占位信息。
- 打开导出弹窗时捕获一次 `ExportSnapshot`；文件树、Monaco 和下载都只读该对象。
- 设计 revision 改变时标记 snapshot 已过期，但不静默替换；重新打开/刷新导出时才生成新 snapshot。
- 文件消失或入口不可用时采用确定性 fallback，不留下无效 Monaco model。
- 窄屏时文件树和编辑器仍可切换/浏览，不发生路径换行破坏行高。

## 范围外

- 不提供文件编辑、新建、重命名或删除。
- 不实现工作区搜索、Git 状态或多标签编辑器。
- Config JSON/Tree 不改为通用文件树。

## 验收标准

- [x] AC1 嵌套路径生成正确目录树，无重复/空目录，排序稳定且图标与文件类型匹配。
- [x] AC2 文件夹展开、折叠、焦点、选择以及规定键盘操作符合 WAI-ARIA Tree 行为。
- [x] AC3 Monaco 内容、显示文件名和 ZIP 对应文件逐字节来自同一 `ExportSnapshot`。
- [x] AC4 revision 变化只显示 stale 状态，不改变已打开 snapshot；用户刷新后才切换新 revision。
- [x] AC5 文件选择失效时回退到入口或首个文本文件；二进制文件不会送入 Monaco。
- [x] AC6 320px 窄屏和桌面下无标签换行、遮挡或不可达操作，亮暗主题均清晰。
