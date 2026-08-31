# ConfigForm 设计器高效编辑与操作历史

## 目标与用户价值

把已有但不易发现、覆盖不完整的编辑能力收口为稳定高效的设计器操作系统。用户可以直接拖拽排序、通过 Layers 和 Canvas 多选批处理，并用标准快捷键与可视化操作历史快速修正错误。

## 已确认事实

- 节点六点手柄已经绑定 pointer drag 和 keyboard drag，`DesignerCanvas` 会生成 `node.move` candidate/command；“只能上移/下移”不是当前架构限制。
- `useDesignerController` 已支持 toggle/range 多选、批量复制/删除/移动，并过滤父子重复选择；Workbench 顶部已有批量复制/删除按钮。
- 当前全局快捷键主要覆盖画布 camera（`Shift+1`、`0`、`+/-`、Space pan），缺少用户要求的 Undo/Redo/Delete/Duplicate。
- 删除可以通过 Undo 恢复，但 UI 没有“已删除，可撤销”的即时反馈。
- 持久化版本历史属于 sibling 任务；本任务的“操作历史”仅指当前编辑 session 的 Model Command timeline。

## 需求

- 六点手柄在 root、非空列表末尾、跨容器和至少三级合法嵌套中均可排序；pointer 与 keyboard 使用同一 target resolver 和 command。
- Canvas 与 Layers 统一支持 Ctrl/Cmd toggle、Shift range、多选状态与焦点同步；选中父子时批量命令只作用于顶层有效集合。
- 批量删除、复制、移动和栅格宽度调整使用一个 transaction，Undo 一次完整还原。
- 支持 Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y、Delete/Backspace、Ctrl/Cmd+D；输入框、Monaco、setter 和 Preview 聚焦时不得误触。
- 删除默认立即执行并显示“已删除，可撤销”toast，toast 撤销与键盘 Undo 进入同一 history，不增加二次确认阻塞。
- 提供可视化操作历史列表，展示命令名称、时间和当前位置；跳转到任意仍保留的步骤必须通过 Engine 的 undo/redo 迁移，不得用 UI snapshot 覆盖文档。
- history 有明确容量、redo 分支截断和不可跳转状态；selection、hover、camera 和 drag 中间帧不进入历史。

## 验收标准

- [ ] 手柄 pointer drag 和 keyboard drag 在 root、末尾、跨容器及三级嵌套中顺序、parent、slot 和 revision 正确。
- [ ] Canvas/Layers 多选后批量删除、复制、移动、span 修改均只创建一个 history transaction，一次 Undo 完整恢复。
- [ ] Windows/Linux 与 macOS 快捷键映射通过；聚焦表单控件、代码查看器或 Preview 时不会删除/复制设计节点。
- [ ] 删除 toast 可撤销且可访问，连续删除和撤销不会恢复错误 transaction。
- [ ] 操作历史可跳转到任意保留步骤；从旧步骤产生新操作后，redo 分支被确定性截断。
- [ ] Element Plus/Ant Design Vue 全物料动态矩阵、Layers/Canvas E2E、keyboard E2E、Model history 单测和 typecheck 通过。

## 范围外

- 不在本任务实现持久化 checkpoint、autosave revision 或跨标签页版本合并。
- 不把 selection、timeline UI 或 drag state写入 `ProjectDocument`。
- 不用 Sortable 等第二套状态源替换现有 Model Command 和 target resolver。
