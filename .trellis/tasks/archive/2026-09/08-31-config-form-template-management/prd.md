# ConfigForm 独立模板管理

## 目标与用户价值

将模板目录、预览和实例化从 Designer 主编辑壳中拆成独立的应用级创建工作区。用户可以在不污染当前编辑会话的前提下，搜索并检查模板，明确选择“创建项目”或“创建页面”，再回到 Designer 编辑一个经过 Registry 校验且 identity 完全独立的新实例。

## 已确认事实

- `WorkbenchShell.vue:25,472-500` 同时直接装配 `TemplateDialog`、首屏模板列表和模板选择事件，Designer 壳仍承担模板目录职责。
- `workbench-ui-store.ts:57,145-154` 只用一个 `templatePickerOpen` 布尔值表达模板 Dialog，无法表达创建目标、独立工作区返回路径或焦点恢复。
- `workbench-controller.ts:443-496,795-799` 根据当前是否存在项目隐式决定创建项目或页面，并用 `Date.now()` 拼接项目 id；现有页面创建已经走一次 `ProjectCommand`，应保留该原子边界。
- `project/templates/types.ts:14-22` 的模板合同只有 adapter、标题、描述、顺序、版本和两个工厂函数，没有 category、Registry requirements、preview metadata 或 provider 边界。
- `project/templates/create-template.ts:28-156` 只有两套 profile fixture，节点和字段 identity 固定；连续实例化会复用 `profile-name`、`name` 等 identity。
- `PreviewRuntimeHostFrame.vue:20-211` 接收结构化 `PageCompilation` 和 transient Runtime 状态，能够承载独立模板预览。
- `createProjectSnapshot` 与 `compileCanonicalPage` 支持从内存中的候选项目构造只读编译结果，不要求先写 Repository。
- Workbench 已依赖 Vue、Element Plus、Lucide、现有 Compiler/RuntimeHost；本任务没有引入新路由或 UI 库的必要。
- `TemplateDialog` 当前没有直接组件测试；E2E helper 依赖名为 `New page` 的 Dialog，现有测试必须迁移到创建工作区语义。

## 需求

### R1. 独立创建工作区

- App 级视图在 `designer` 与 `create` 之间切换；`WorkbenchShell` 不再导入、渲染模板列表或持有模板浏览状态。
- 创建工作区必须显式携带 `project` 或 `page` 目标，禁止根据 `currentProject` 隐式猜测。
- 首次启动且没有项目时直接进入“创建项目”，此状态没有虚假的返回目的地；从 Topbar 或 Pages 进入时，关闭或返回后恢复原触发控件焦点。
- Pages 管理提供独立的“新建项目”和“新建页面”入口；Topbar 的现有新建页面命令进入同一工作区。

### R2. 模板目录与 Provider 合同

- 模板 manifest 至少包含 `id`、`version`、`displayName`、`description`、`adapter`、`category`、`order`、Registry requirements、preview metadata 和标签。
- 模板来源使用只读异步 Provider interface；本任务只注册内置本地 Provider，但目录服务不得依赖模板文件位置或 UI。
- Provider 数据必须是 JSON-safe 的 manifest + seed，不能携带任意函数、Vue 组件、HTML、脚本或远程可执行内容；实例化工厂归模板服务所有。
- 目录服务统一负责排序、重复/非法 id、版本、危险 key、seed schema 和 provider 失败诊断。UI 不自行解析 Provider 数据。

### R3. 内置模板和目录交互

- 提供 Element Plus 与 Ant Design Vue 的空白模板和资料表单模板，共四个内置条目；`profile` 只保留为 fixture 内部术语。
- UI 使用“空白表单”“Element Plus 资料表单”“Ant Design Vue 资料表单”等用户可理解名称，不暴露内部 template id。
- 支持文本搜索、category 筛选、provider 筛选、模板选择、详情、返回和创建；搜索覆盖显示名、描述、标签和 provider。
- 无搜索结果、Provider 加载失败、预览失败和不兼容状态都给出明确下一步，不能只显示空白区域。

### R4. Registry 与 adapter 兼容性

- 创建前验证目标 adapter、模板声明的组件要求、当前 Registry contract 和 seed schema。
- 创建项目时加载模板 adapter 的当前 Registry；创建页面时只允许与当前项目 Registry lock 兼容的模板。
- 不兼容模板可以浏览和查看诊断，但创建按钮必须禁用；诊断指出 adapter、缺失组件、contract version 或 fingerprint 的具体差异。
- compiler 仍执行最终 fail-closed 校验；目录兼容性检查不能替代 Model/Compiler 边界。

### R5. 独立 identity 与不可变 seed

- 每次实例化生成新的 project、page、node、field、reaction、flow、flow-node 和 flow-edge identity；同一实例内的 root、slot、condition、reaction、validation 与 Flow 引用同步更新。
- identity remap 是一个纯函数，支持注入 nonce/id factory 以做确定性测试，并在 JSON 导入任务中复用。
- 模板 seed、已创建实例和其他实例之间不得共享可变对象；修改任一实例不能改变 Provider 数据或另一实例。
- opaque action config 不做猜测式字符串替换；只有正式类型合同声明的 identity 引用可被重映射，无法证明安全的模板必须 fail closed。

### R6. 只读模板预览

- 详情预览从 seed 创建独立内存候选项目，通过 `createProjectSnapshot`、Compiler 与现有 `PreviewRuntimeHostFrame` 渲染。
- 预览拥有自己的 values、touched、validation 和 reaction projection；它不能复用或更新当前 `PreviewSession`、selection、history、persistence revision 或 autosave。
- 快速切换模板时，过期的 adapter/compile 结果不得覆盖当前选择；预览错误以模板级诊断呈现。
- RuntimeHost 继续只接收结构化 clone 数据，adapter resolver、Vue 组件和函数不跨 iframe 协议。

### R7. 原子创建与返回

- 创建项目先完成 catalog、adapter、Registry、schema 和 compile 预检，再调用 Repository `create`；失败时当前项目、history、selection、persistence revision 和创建工作区选择保持不变。
- 当前项目存在未解决的保存冲突或不可安全切换的未保存状态时，创建新项目必须阻止并给出保存/解决提示；创建页面继续作为当前项目的一次正式 Command。
- 创建页面产生一次 history/editVersion，支持 Undo/Redo；创建成功后打开新实体、关闭创建工作区并把焦点落到稳定的 Designer 入口。
- 重复点击、busy 状态和过期异步请求不能创建重复实体。

### R8. 生产级 UI 与可访问性

- 视觉方向是安静、密集的 IDE 资源浏览器：左侧目录，右侧真实 Runtime 预览与 Registry 兼容性信息；不使用营销 hero、装饰性卡片堆叠或嵌套卡片。
- 1440px 使用双栏目录/预览；900px 收紧目录宽度；390px 使用明确的“目录/详情”移动视图，所有命令可达且无横向溢出。
- Light/Dark、zh-CN/en-US 下文本不截断关键含义，长模板名/诊断可换行，创建命令保持稳定尺寸。
- 目录使用语义列表和可见选中态；键盘支持上下/Home/End 选择、Enter 查看、Escape/返回，筛选控件有可访问名称，异步状态使用合适的 `status`/`alert`。
- 动效仅用于必要的视图切换并尊重 `prefers-reduced-motion`；真实 RuntimeHost 是主要视觉内容。

### R9. 文档和质量证据

- 更新 Workbench 架构边界测试、ConfigForm 架构 README，以及必要的 Designer state spec。
- 单测覆盖 manifest/provider 校验、兼容性矩阵、identity remap、深拷贝、过期请求和原子失败。
- 组件测试覆盖搜索/筛选、详情、不可创建诊断、键盘与焦点恢复。
- Playwright 覆盖两套 provider 的项目/页面创建、Runtime 预览、连续实例 identity、返回路径、390/900/1440、两主题、双语和 axe。

## 验收标准

- [ ] AC1：`WorkbenchShell` 不再引用 `TemplateDialog`、模板目录或 `templatePickerOpen`；所有入口进入 App 级创建工作区。
- [ ] AC2：目录服务返回四个稳定排序、JSON-safe、schema-valid 的内置模板，并暴露只读 Provider interface。
- [ ] AC3：用户可从空白或资料表单创建 Element Plus/Ant Design Vue 项目，并可向兼容的当前项目创建页面。
- [ ] AC4：连续两次从同一模板创建时，project/page/node/field/flow/reaction identity 均不重复，且修改实例不污染 seed 或另一实例。
- [ ] AC5：adapter/Registry/schema 不兼容时，创建前显示可操作诊断并禁用提交，当前编辑会话完全不变。
- [ ] AC6：模板详情使用独立 RuntimeHost 预览；切换模板和交互预览不改变当前项目 Preview、history、selection 或 persistence revision。
- [ ] AC7：创建项目走 Repository 正式入口；创建页面走一次 Project Command 且一次 Undo 可回退。
- [ ] AC8：搜索、筛选、目录/详情、返回、创建和焦点路径在 1440/900/390、Light/Dark、zh-CN/en-US 下通过交互、视觉和 axe 检查。
- [ ] AC9：定向单测、Workbench typecheck/build、两套 provider E2E、根 lint、`git diff --check` 与 ConfigForm package gate 全部通过。

## 关键产品决策

- 模板管理是应用创建工作区，不是 Dialog，也不是 Designer 内的新面板。
- 创建目标必须显式；项目与页面不会继续由“当前是否存在项目”推断。
- 四个内置条目分别表达 Provider 与 blank/profile 内容，避免在创建按钮之后再弹第二层 Provider 选择。
- 页面模式展示但禁用不兼容模板，保留用户理解“为什么不能用”的能力。
- 不引入 Vue Router：当前 Workbench 是单视图嵌入式应用，App 级枚举视图足以形成独立边界，且不会制造 URL/宿主路由合同。

## 范围外

- 远程模板市场、网络下载、账户 Profile、付费、评分、发布审核、云同步和多人协作。
- 模板编辑、发布、上传、删除或覆盖内置模板。
- 任意 JavaScript、Vue SFC、HTML、远程脚本或未注册组件的模板执行。
- JSON 粘贴/文件导入；该入口由后续 `config-form-json-import-lifecycle` 接入同一创建工作区。
- 修改 `ProjectDocument` 来保存模板目录、搜索、筛选、选中、预览值或创建工作区状态。

## 阻塞问题

无。现有需求和仓库证据已覆盖产品、范围、UX、兼容性与风险决策。
