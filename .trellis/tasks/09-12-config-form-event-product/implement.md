# 实施顺序

- [ ] Core flow 合同/策略/生命周期/trace/严格诊断与测试。
- [ ] Core flow-authoring 步骤转换/复制/引用可达性与测试。
- [ ] 合并接口并代码审查，修复基础缺陷。
- [ ] Model/Compiler schema、流程验证和数据流贯通。
- [ ] FlowWorkspace 结构化草稿编辑、动作/条件参数控件与Save/Cancel/冲突。
- [ ] Renderer/Host/Preview/Source 生命周期协调与行为parity。
- [ ] 数据源/变量/数组scope接入来源选择与运行上下文。
- [ ] Trace UI、双组件库E2E、指定视口、无障碍与文档。

## 当前文件所有权

Core内核代理仅改 `core/src/flow/**`、必要 `core/src/reaction/**` 的严格表达式诊断及独立core测试；作者树代理仅改新 `core/src/flow-authoring/**` 及新测试。公共 `core/index.ts`、Model、Compiler和其他包由主代理集成，避免并发同路径修改。

## 验证

先 Core `test/typecheck` 与新增定向用例。跨包合并再运行Model/Compiler/Runtime/Workbench测试与类型检查、实际导出parity。最终按父implement.md完整质量门禁，不以局部通过代替父合同。
