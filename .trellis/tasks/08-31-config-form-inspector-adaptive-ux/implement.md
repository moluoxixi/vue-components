# ConfigForm Inspector 自适应属性体验实施计划

## 1. 实施顺序

1. 建立失败基线：为当前固定/部分动态页签、异构多选、未知 event/binding 被隐藏、active tab 漂移、分数缺失和六页签 E2E 写定向失败测试。
2. 提取纯 capability resolver 与类型：归一化 section 顺序、stored-content 并集、can-create 交集、setter compatibility、stale item；用 field/layout、相同/异构组件和缺失 Registry fixture 覆盖。
3. 让 `DesignSurface` 向 Inspector 提供所有选中节点的 material/contract 查询能力，同时保留现有 properties slot scope 和公共组件边界。
4. 重构 `DesignerPropertyPanel` 消费 projection：动态 tabs、公共 setters、合法/陈旧 event/binding、条件/联动可见性，以及完整 selection/section watch。
5. 增加结构化 stale warning 与精确删除命令：未知值只读展示；删除走受限的 `node.config.remove` Project operation，补齐 locale、readonly、相邻配置保留和一次 undo 回归。
6. 实现分数 helper：最大公约数约分、整宽百分比、invalid/clamp 边界；接入 form fieldSpan、根节点 span 和 `DesignerResponsiveSettings` 的 desktop/tablet/mobile 最终值。
7. 收口 tab/diagnostic 交互：roving tabindex、方向键/Home/End、活动 tab 回退、条件焦点恢复、激活项自动滚入视口和 reduced-motion；补窄宽组件测试。
8. 更新 Workbench E2E：删除固定六页签假设，按两套 Provider 的代表组件验证 section 矩阵、陈旧清理/undo、fraction 即时更新和 304/900/390 几何。
9. 运行两套 Provider、axe、键盘与浏览器视觉复核；人工检查 zh-CN/en-US、Light/Dark、长 key、只读态和多选诊断密度。
10. 运行完整质量门禁并做独立 Trellis check；按架构规范判断是否需要同步 `packages/ConfigForm/README.md` 或新增 Designer state spec 条款。

## 2. 定向测试矩阵

### Resolver 单测

- field/layout 的 properties、validation、events、bindings、conditions、reactions 可见性；
- declared capability、stored content、unknown stored key 的组合；
- 相同组件多选与异构组件的 setter/event/binding/condition 交集；
- 任一非主节点含陈旧配置时 section 仍可见并定位正确 node/path；
- material/contract 缺失时保守只读，不抛错、不隐藏数据。

### 组件与命令测试

- tablist/tabpanel ARIA、roving tabindex、Arrow/Home/End、selection 切换和焦点回退；
- event/binding 未知值不经文本序列化，删除精确 path，不影响相邻 key；
- layout field-only condition、异构多选 reaction 和 validation 的合法可见性；
- readonly 下可见不可删，多选批量 command 一次撤销；
- fraction `12/24`、`8/24`、`24/24`、非整除/继承/clamp，以及修改后的实时刷新；
- `DesignerResponsiveSettings` 每个 breakpoint 的最终 fraction。

### Provider 与浏览器测试

- Element Plus 与 Ant Design Vue 的 Input/Switch/Section 或 Grid/Tabs/Collapse section 集合；
- 304px 默认 Inspector、900px non-modal overlay、390px full-screen 的 tab 单行轨道、tabpanel 和 warning 操作；
- axe、键盘全路径、locale/theme；
- 删除陈旧项、Undo 恢复、Config/Source Export 前后只有目标模型 path 变化；
- Runtime/Preview DOM 和布局 computed geometry 不因 fraction 展示改变。

## 3. 质量命令

```powershell
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @moluoxixi/config-form-designer-antd-vue typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm test:config-form-packages
pnpm lint
git diff --check
```

若实际 package script 名称与上述命令不一致，实施阶段先用 package.json 的现有脚本校正命令，不新增重复脚本。

## 4. 高风险文件与止损点

- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel.vue`：动态 section 与焦点核心；出现不可达配置、tab 焦点落空或主节点掩盖多选数据时回滚组件集成批次。
- `packages/ConfigForm/designer/src/components/DesignSurface.vue` / `components/types.ts`：Registry bridge 与 slot 兼容；不得改变现有 properties slot 的字段含义。
- 新 capability resolver：必须保持纯函数和 UI 库无关；若开始复制 Provider 注册表或 Runtime 规则，回到设计评审。
- `DesignerResponsiveSettings.vue` 与 fraction helper：不得复制响应式继承算法或写入 fraction；任何 Project JSON diff 都是阻断问题。
- `graph/commands.ts`：优先复用现有精确删除能力；若确需扩展 command，必须有 Model transaction/undo 测试并重新评估跨包范围。
- Workbench E2E snapshots/geometry：只更新明确由自适应 tabs/diagnostics/fraction 导致的局部基线，不批量接受无关视觉变化。

## 5. 实施期间自审门禁

- 每批完成后反向检查：有没有已有配置仍被隐藏；有没有多选错误开放；有没有为展示创建第二份状态；有没有绕过 Project Command。
- 对未知配置先证明保真查看与精确删除，再优化视觉密度。
- 对每个新 helper 先搜索同类实现；fraction 只抽象一次，能力规则只由一个 resolver 拥有。
- 完成实现后由独立 `trellis-check` 做全范围 spec/PRD/design/implement 审核并直接修复发现项。

## 6. 启动前复核

- PRD R1-R6 已映射到 AC1-AC7，无阻塞产品问题。
- `design.md` 已明确 Registry/PageNode/ProjectCommand/Runtime 所有权和 stale recovery 规则。
- `implement.jsonl`、`check.jsonl` 均含真实 spec 条目，不保留 `_example`。
- 本轮只完成规划，不运行 `task.py start`；等待用户对最终规划摘要作后续明确批准。
