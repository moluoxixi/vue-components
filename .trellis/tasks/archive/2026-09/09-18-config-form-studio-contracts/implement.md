# ConfigForm Studio 产品与领域合同实施计划

## 执行范围

本任务只更新长期产品文档、架构 README 和 `.trellis/spec/`。不修改产品 TypeScript/Vue、package manifest、锁文件、持久化数据或生成模板，不创建 Prototype Runtime/Source 空包。

## 1. 建立文档状态层次

- [ ] 重写 `packages/ConfigForm/PRODUCT.md`：目标用户、Studio/Designer/Runtime/Source 分工、Surface/Dataset/Prototype Interaction、单向交付、非目标和扩展准入。
- [ ] 重写 `packages/ConfigForm/ROADMAP.md`：明确当前 Page-only 基线、七阶段迁移、每阶段完成定义、已终止事件域和已知风险。
- [ ] 更新仓库根 `README.md` 与 `packages/ConfigForm/README.md`：展示双路径架构和依赖方向，并标注规划包尚未实现。
- [ ] 将 `packages/ConfigForm/designer/README.md`、`workbench/README.md` 拆成“当前实现”和“目标责任”，避免把三栏 Inspector、Surface 或独立 Source 写成现状。
- [ ] 修正 Headless 的 Runtime-first 标签，并在两个 Designer adapter README 中区分代码态 `optionResolver` 与 Studio Dataset。
- [ ] 暂不改写 Model、Compiler、Vue backend 的 Page-only API 说明；记录由 surface-foundation 同步更新。

## 2. 固化共享领域合同

- [ ] 重写 `.trellis/spec/config-form/frontend/product-boundaries.md`，保留生产 `props.onX` 与禁止事件域规则，替换 Designer Lite/Workbench internal 的旧定位。
- [ ] 新增 `.trellis/spec/config-form/frontend/studio-domain-contracts.md`，写入 Surface/Instance、Dataset/Data Source、三类交互、参数/结果、Source resolver 和依赖方向。
- [ ] 写入目标签名、稳定诊断 code/context、好/基线/坏案例和测试矩阵。
- [ ] 写入目标版本表和 current-contract-only 原子硬切规则，明确版本由哪个子任务拥有。
- [ ] 固定 `@moluoxixi/config-form-prototype-runtime` 目标入口和无 DOM/Vue 分层，但不创建包。

## 3. 更新 spec 路由和质量合同

- [ ] 更新 ConfigForm、Model、Compiler、Designer、Workbench、Headless、Vue backend 的 spec index，使后续子任务都能发现新共享合同。
- [ ] 更新 `.trellis/spec/config-form-core/frontend/architecture-documentation.md`，要求目标/当前状态分层和新公共包落地时同步架构事实源。
- [ ] 更新 `.trellis/spec/config-form/frontend/runtime-state-boundaries.md`，区分持续状态投影、变化触发值动作、Prototype UI 动作和生产 host listener。
- [ ] 更新 `.trellis/spec/config-form-workbench/frontend/quality-guidelines.md`，记录 Studio/Experience/Source 的目标所有权，同时保留现有 Monaco、持久化、焦点和可访问性门禁。
- [ ] 若新增规划包 spec 路由，显式标注实现尚不存在；不得让 package index 宣称可导入入口。

## 4. 一致性审查

- [ ] 搜索并逐项判断 `Runtime-first`、`Designer Lite`、`Workbench internal`、双 Inspector、动态 Data Source 作者 UI 和静态 Source 文案；历史 changelog/归档任务不改。
- [ ] 搜索 `event`、`flow`、`handler registry` 等术语，确认只用于禁止项、历史现状或生产 `props.onX`，没有恢复事件编排。
- [ ] 检查 Dataset 查询与 Materials selection、Source resolver 与 adapter metadata、Prototype Runtime 与生产 Runtime 的所有权只出现一个权威定义。
- [ ] 检查所有本地 Markdown 链接、包名、目标路径和版本表一致。
- [ ] 对照父任务 AC1-AC12 与本任务 AC1-AC8 做人工映射。

## 5. 验证命令

```powershell
python ./.trellis/scripts/task.py validate 09-18-config-form-studio-contracts
python ./.trellis/scripts/task.py validate 09-18-config-form-demo-studio
pnpm exec eslint README.md packages/ConfigForm/README.md packages/ConfigForm/PRODUCT.md packages/ConfigForm/ROADMAP.md packages/ConfigForm/designer/README.md packages/ConfigForm/workbench/README.md packages/ConfigForm/headless/README.md packages/ConfigForm/designer-element-plus/README.md packages/ConfigForm/designer-antd-vue/README.md .trellis/spec/config-form .trellis/spec/config-form-core .trellis/spec/config-form-model .trellis/spec/config-form-compiler .trellis/spec/config-form-designer .trellis/spec/config-form-workbench .trellis/spec/config-form-headless .trellis/spec/config-form-vue-backend
pnpm test:package-architecture
```

另外运行定向 `rg` 检查旧定位残留和规划包的“已实现”误述。若 ESLint 不处理 Markdown，则记录该项不可用并以链接/搜索审计和架构测试替代，不扩大到全仓自动修复。

## 6. 审阅门槛

- [ ] 产品文档、架构 README 与 spec 对 Studio 边界无冲突。
- [ ] 所有规划能力均明确为目标状态；所有当前 Page-only API 均未被伪装为已迁移。
- [ ] 事件编辑、事件转发、动作链、Flow、HTTP 作者能力和兼容层仍被明确禁止。
- [ ] 后续六个子任务能直接引用稳定术语、签名、诊断、版本和依赖方向。
- [ ] 变更仅限文档/spec/Trellis 任务工件，`git diff --check` 通过。

## 风险与停止条件

- 若实施发现必须修改产品代码才能让文档成立，停止并把工作移入相应实现子任务。
- 若新证据要求改变用户已确认的产品范围，回到父任务规划并重新审阅。
- 若两个文档需要同时把同一能力描述为“当前”和“目标”，优先拆分状态章节，不用模糊时态掩盖差异。
- 回滚单位是本合同任务的整组文档/spec 变更；不保留半套新术语与半套 Runtime-first 规范。
