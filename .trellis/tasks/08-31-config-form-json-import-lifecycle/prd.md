# ConfigForm JSON 导入与新建流程

## 目标与用户价值

在统一的新建工作区中提供受约束的 Config Model JSON 导入能力。用户可以把 Workbench 导出的项目 JSON 或单页 JSON 安全地创建为新项目或新页面，并在确认前看到迁移、兼容性和结构诊断；任何失败都不得覆盖或污染当前设计会话。

## 已确认事实

- Export Dialog 的 JSON 视图直接序列化不可变 `ProjectCompilation.snapshot.document`，当前项目协议是 `ProjectDocument.schemaVersion = 4`、`PageGraph.version = 2`。
- 当前 Export Dialog 尚未提供单页 JSON 范围，必须补齐才能形成页面级 round-trip。
- `parseProjectDocument`、`projectPageSchema`、Compiler Registry 诊断和 `ComponentContractRegistry.analyzeLock/migrateNode` 已提供严格 schema 与组件合同基础。
- 归档历史证明唯一可支持且无歧义的项目迁移是 v3→v4：把 `page.graph.flows` 移到 `page.flows`；旧页面模型 v1 可以确定性地展平为 PageGraph v2。
- 新模板流程已经具备隔离 Runtime 预览、全量页面身份重映射、Repository 创建补偿和单次 Project Command 页面创建，可复用其边界而不是另建状态系统。
- 产品边界明确排除 `.vue`、Source 工程、ZIP、任意 HTML 与用户 JavaScript 的逆向导入。

## 范围内需求

### R1. 对称输入入口

- 新建项目和新建页面工作区均提供“模板 / JSON 导入”模式切换。
- JSON 导入支持粘贴文本以及本地单个 `.json` 文件；文件只在浏览器本地读取，不上传。
- 项目目标只接受 Project JSON；页面目标只接受 Page JSON。类型不匹配在确认前拒绝，不从项目 JSON 猜测要导入哪个页面。
- Export Dialog 的 JSON/Tree 视图增加“整个项目 / 当前页面”范围，复制与下载使用同一不可变导出快照。

### R2. 明确的版本与迁移矩阵

- 当前 Project v4 与当前 PageGraph v2 必须无损解析。
- Project v3 仅按历史合同迁移到 v4：若 `graph.flows` 与 `page.flows` 同时存在则因归属歧义拒绝。
- 旧 Page Model v1 仅按历史合同迁移到当前 `ProjectPage + PageGraph v2`，树节点、slot、placement、Flow、reaction 和 validation 必须保留。
- 未知、缺失、未来版本以及旧 Workspace Application/Source 工程格式 fail closed；迁移结果必须再次通过当前严格 schema。
- 预览中逐条展示迁移来源、目标版本和影响范围，创建前不静默改写。

### R3. 分层解析与安全限制

- 顺序固定为：源大小检查 → JSON 语法 → 迭代式结构预算/污染键检查 → 版本识别与迁移 → 当前 schema → Registry/adapter → identity remap → compile preview。
- 源文本上限 2 MiB；最大结构深度 64；任一数组最多 4096 项；总对象属性与数组元素最多 100000 项。
- 单项目最多 128 个页面、4096 个表单节点；超限必须给出稳定诊断码与 JSON path。
- 任意深度的 `__proto__`、`prototype`、`constructor`、非有限数值、函数或非 JSON 值均拒绝；原始输入不得进入 Runtime、Repository 或 Command。
- 文件扩展名/MIME 只用于选择器提示，安全判断必须基于读取后的内容。

### R4. Registry 与 adapter 兼容性

- 项目导入根据导入文档的 `registryLock.adapter` 加载 Workbench adapter，只允许现有 `element-plus` 与 `antd-vue`。
- 项目 Registry lock 与当前可用合同逐组件比较；存在已注册的确定性 migration chain 时先迁移节点并展示记录，否则拒绝缺失组件、版本或 fingerprint 不兼容。
- 页面 JSON 不携带项目 Registry lock，必须在当前项目的 adapter、lock 和可用 Registry 三者上逐组件预检。
- 兼容性失败只产生诊断，不改变当前 adapter、Preview、selection 或历史。

### R5. 新实例身份与语义保持

- 项目导入始终创建新的 project/page/node/field/reaction/Flow/Flow node/Flow edge 身份；页面导入始终创建新的 page 及页面内身份。
- remap 必须同步 hierarchy、slot、compare rule、condition、reaction、Flow trigger/edge/typed config 引用，并在 remap 后重新通过当前 schema。
- 项目资源保持原有资源 id、map key、URI、integrity 与 metadata，因为资源只在新项目命名空间内生效；不得猜测或字符串替换不透明 metadata。页面 JSON 不携带项目资源。
- 项目 settings、页面 props/form、placement、events/bindings/extensions 和未知但合法的 JSON 元数据必须无损保留。

### R6. 诊断预览与创建合同

- 分析成功后展示类型、名称、adapter、schema/page graph 版本、页面/节点/Flow/资源数量、迁移清单和 diagnostics。
- 预览只消费严格验证、迁移、兼容检查和 identity remap 后的 canonical page；项目预览首页，页面导入预览该页。
- 项目创建复用 Repository `create`、打开项目和失败补偿合同；只有新项目成功激活后才发布 session。
- 页面创建先对完整候选项目 compile preflight，再通过单个 `page.add` Project Command 创建；一次 Undo 必须完整撤销。
- 异步分析/adapter/preview 使用请求序号和 captured project hash，过期结果不得覆盖新输入或新会话。

### R7. 生产级交互与可访问性

- 桌面保持高信息密度的输入/诊断/预览布局；900px 与 390px 使用明确的源、诊断、预览步骤或 pane 切换，无横向滚动。
- 分析、清空、选择文件、创建、取消均有可访问名称；错误摘要使用 live region，诊断列表保留 code、path 与 message。
- 文件选择后显示文件名和格式化大小；重新选择、清空或切换模式会释放旧预览资源并恢复确定性焦点。
- Light/Dark 与 zh-CN/en-US 文案完整，不展示内部异常堆栈或把技术错误作为唯一说明。

### R8. Round-trip 与质量证据

- Project JSON 导出→导入→再次导出在去除新实例 identity 后语义等价。
- Page JSON 导出→导入→再次导出在去除新实例 identity、自动名称/路由后语义等价。
- Element Plus 与 Ant Design Vue 分别覆盖粘贴和文件输入、项目和页面创建。
- parser/migration/security 单测、基于 `fast-check` 的 round-trip 属性测试、controller 原子性测试、组件测试、Playwright、typecheck、build、lint 和边界检查全部通过。

## 验收标准

- [ ] AC1：Export Dialog 可复制/下载当前 Project JSON 和当前 Page JSON，导入入口分别接受并创建新实体。
- [ ] AC2：Project v3→v4、Page Model v1→PageGraph v2 显式展示迁移；歧义或未知/未来版本在创建前拒绝。
- [ ] AC3：语法、schema、污染键、深度/大小/数量、未知组件和 Registry 不兼容均返回稳定诊断且当前项目快照完全不变。
- [ ] AC4：identity remap 后 hierarchy、slot、field、reaction、Flow trigger/edge/config 引用一致，schema 再验证通过且无重复 id。
- [ ] AC5：项目 Repository 创建/open 失败完成补偿；页面导入只产生一个可撤销 Command，不留下半创建实体或错误 revision。
- [ ] AC6：隔离预览真实渲染两套 adapter 的 imported page，原始 JSON 从不进入 Runtime。
- [ ] AC7：1440/900/390、Light/Dark、zh-CN/en-US 下可读、无溢出，粘贴/文件/取消/返回焦点和键盘路径通过可访问性检查。
- [ ] AC8：Project/Page round-trip 属性测试与双 adapter E2E 通过，Workbench 全量测试、类型、构建、lint、公开边界和 `git diff --check` 通过。

## 范围外

- 不导入 `.vue`、TypeScript Config Source、`package.json`、ZIP 工程、Babel AST、任意 HTML DOM 或用户 JavaScript 函数。
- 不允许 JSON 覆盖当前 ProjectDocument，也不提供“合并整个项目”或跨项目页面选择器。
- 不恢复已 hard cut 的旧 Repository/Workspace Application 运行时兼容层；迁移仅存在于显式 import ingress。
- 不把 Config/Source 查看器改回可编辑 provider，不执行输入内的 URI 或远程资源。

## 阻塞问题

无。产品范围、兼容窗口、失败语义和交互入口均已由现有需求与仓库证据确定。
