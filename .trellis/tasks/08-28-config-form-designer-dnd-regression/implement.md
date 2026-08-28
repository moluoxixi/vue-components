# Designer 拖拽落点与全物料回归测试实施计划

## 实施顺序

1. [ ] 在 Element Plus 与 Ant Design Vue Playground 中复现三类问题，记录 material key、父容器、slot、拖动坐标和最终 Model。
2. [ ] 先补纯函数测试：列表身份解析、合法 slot、非空列表 trailing index、空槽 sentinel、非法 target 和取消清理。
3. [ ] 实现统一 drop target resolver，并接入 Palette clone、root list 和递归嵌套 `DesignerNodeList`；确保 `index === siblings.length` 能追加。
4. [ ] 增加合法/非法 slot 的 `onMove` 反馈和最终 Model 诊断，修复布局容器投放及跨容器移动。
5. [ ] 收敛 Element/AntD date、time、range/time-range 的 Designer control 宽度，补 desktop/tablet/mobile 与 label left/top 几何断言。
6. [ ] 从两个 Registry 动态生成全物料矩阵，覆盖 click、drag、root、合法嵌套、末尾追加、渲染、undo/redo 和受限 slot 拒绝。
7. [ ] 更新 Designer 单测、适配器测试和 Playground Chromium E2E；失败输出 adapter/material/slot/index 上下文。
8. [ ] 运行质量门禁，完成 diff 审查后再申请启动实现。

## 验证命令

```powershell
pnpm --dir packages/ConfigForm/designer test
pnpm --dir packages/ConfigForm/designer typecheck
pnpm --dir packages/ConfigForm/designer build
pnpm --dir packages/ConfigForm/designer-element-plus test
pnpm --dir packages/ConfigForm/designer-antd-vue test
pnpm --dir packages/ConfigForm/playground typecheck
pnpm --dir packages/ConfigForm/playground test:e2e -- --project=chromium --grep "designer|material|drag|drop"
pnpm lint
git diff --check
```

## 风险门

- Sortable 的 DOM index 不能把空槽提示、slot marker 或 ghost 元素计入 Model index。
- 非法 slot 必须在 UI 反馈和 reducer 两层拒绝，不能为了让拖拽“成功”绕过 Registry。
- 宽度修复只能限制 Designer/adapter scope，不能改变外部 ConfigForm Runtime 的通用样式。
- 全物料矩阵不能通过删除难测物料来绿灯；无法自动化的组件必须明确登记原因和替代验收。
