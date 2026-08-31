# 设计器高效编辑与操作历史实施计划

## 1. 实施顺序

1. 激活任务并确认当前 Workbench/Designer 规范、测试基线。
2. 扩展编辑器 session 的只读 history 摘要与 Workbench UI 通知边界，保持
   `ProjectDocument` 不变。
3. 将删除、复制和撤销/重做统一接入 DesignSurface 快捷键与 toolbar，补充
   editable target、Preview iframe、readonly 和 modifier 映射判断。
4. 在 Studio 左侧增加可折叠的 History 视图，支持条目跳转、redo 分支提示和
   当前位置标记；所有跳转只调用 session undo/redo。
5. 实现删除后的可访问撤销通知，处理一次性 callback、连续操作和失败状态。
6. 补充 model/session/design/workbench 单测，以及 Element Plus、Ant Design Vue
   的 Canvas/Layers/keyboard/History E2E。
7. 运行 lint、typecheck、Workbench test、E2E、构建和 diff 检查，更新 state
   management spec 后提交并归档。

## 2. 验证命令

```powershell
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @moluoxixi/config-form-model typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm lint
git diff --check
```

## 3. 回归矩阵

- Canvas/Layers：replace、Ctrl/Cmd toggle、Shift range、父子选择过滤。
- 批量删除/复制/移动/span：单 command、单 revision、一次 Undo 完整还原。
- 快捷键：Windows/Linux 与 macOS modifier；输入控件、Monaco、Preview 不误触。
- 删除通知：成功、readonly/失败、连续删除、撤销后通知关闭。
- History：当前项、undo/redo、跳转、redo 分支截断、容量边界。
- Provider：Element Plus 与 Ant Design Vue 各自至少一个字段、布局和嵌套节点。

## 4. 完成门禁

- 不新增第二份文档、历史 reducer 或页面模型。
- 浏览器断言设计态节点保持 inert，Preview 仍可交互。
- 所有批量动作与快捷键都能追溯到 `ProjectEditorSession` 的 command/history。
- 新增的历史摘要、通知和快捷键合同写入适用规范。
