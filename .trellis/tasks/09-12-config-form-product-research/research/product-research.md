# 已发布表单产品实测与 ConfigForm 差距

## 结论

本报告基于 2026-09-12 的 38 张正式截图及对应临时操作记录。E01-E32 保留此前整理结果；本次另以隔离 Playwright 浏览器补测 VForm3Pro，新增 E33-E38。FormCreate Pro 已有事件入口、动作、条件、引用、请求测试、子表单、校验、预览与生成视图的连续实测链；VForm3Pro 在原有身份、拖入、基础子表单、必填与生成视图之外，现已补齐表格子表单 1 到 2 到 1、自然数组取数、完整 JSON 同值往返及往返后字段和行操作。

VForm3Pro 的动作/条件编排、真正两层嵌套、SFC 实际下载及可运行导出工程仍未验证。因此本报告仍是父任务 AC1 的阶段性证据，不代表 AC1 完整通过，更不代表本地 AC2-11 已实现；本次未修改业务源码或父验收台账。

正式截图见 [evidence-index.md](./evidence-index.md)。原始 JSON 操作记录继续保留在会话 scratch 中，没有纳入正式交付。

## 证据口径

- **O（操作实测）**：记录中保存了具体操作后的界面或运行结果，并有正式截图。
- **I（界面声明）**：已看到入口、标签或说明文字，但没有执行该能力；不能当成运行行为。
- **D（文档声明）**：来自官方文档但未实操。本轮遗留记录没有保存官方文档页面，故本报告没有 D 类结论。
- **U（未验证）**：没有足够证据，明确保留未知，不按产品名称、入口名称或经验推断。

所有时间均为 UTC。正式截图中 E01-E20 为 1440x900，E21-E38 为 1600x1000；均来自已发布在线产品公开页面。未购买授权、未登录、未读取商业源码、未上传项目数据。早期 FormCreate 请求测试使用只读公共测试 GET；早期 VForm3Pro 数据源请求由浏览器拦截返回隔离数据。本次 E33-E38 各试验使用新 context，不读取已有浏览器 credentials/storage，不触发数据源或真实业务端点请求，不构造 fake 返回；只通过公开 UI、鼠标、键盘和编辑器 DOM 取证，不调用应用内部 Vue 对象或私有函数。

## 产品与访问元信息

| 产品 | 本轮入口与实际 URL | 访问窗口 | 可获取版本 | 限制 |
| --- | --- | --- | --- | --- |
| FormCreate Pro | 实际记录 URL：`https://pro.form-create.com/view/` | 2026-09-12 12:23:48 至 12:53:23 | 页面仅显示 `FcDesigner Pro | Element Plus 版`、Vue 3；数值版本未知 | 未登录；“保存”要求登录，未继续；导入入口未在遗留记录中找到 |
| VForm3Pro | 实际操作记录 URL：`http://pro3.vform666.com/`，页面标题 `Variant Form 3 Pro` | 原记录 2026-09-12 12:54:24 至 13:18:12；本次正式补证记录 19:32:54 至 19:37:42 | 页面显示 `VForm3 Pro`、`Ver 3.6.20` | HTTP 剪贴板限制仍保留；已通过公开编辑器翻页取得完整 JSON。“保存为文件”确认后下载被取消；无可用下载文件，未下载或运行 SFC 工程 |

## FormCreate Pro 实测

### 1. 事件入口与编排

**状态：O。**

复现路径：

1. 打开官方在线设计器，右侧“表单配置”进入“表单事件 > 设置事件”。
2. 事件列表可见 `onSubmit`、`onReset`、`onCreated`、`onMounted`、`onBeforeUnmount`、`onReload`、`onChange`、`beforeSubmit`、`beforeFetch`。
3. 选择 `onSubmit`，切换“事件流”，通过节点间的加号打开“动作/条件”菜单。
4. 拖入输入框，在组件“事件配置 > 设置事件 > 创建事件”中选择 `change`；组件事件编辑区同时提供“事件流 / 自定义 / 全局事件”。

观察：表单级和组件级入口均围绕业务事件组织，事件流呈“开始 -> 顺序节点/条件分支 -> 结束”，无需先理解内部节点 ID 或连线 JSON。组件事件菜单还显示焦点、输入、清空、加载、挂载、卸载、删除、规则变化、值变化、显隐变化及标签点击等入口。证据：[E01](./evidence/fc-01-event-menu.png)、[E02](./evidence/fc-03-event-flow.png)。

未验证：事件真实触发顺序、复制流程、节点排序、取消后是否完全回滚、保存重开，以及快速重入/并发行为。

### 2. 动作分类与参数

**状态：O（配置界面），I（未执行动作）。**

复现路径：事件流中添加“动作”，点击动作卡片配置，依次展开“页面 / 弹窗 / 表单 / 其他”。

观察到的动作包括：

- 页面：跳转页面、刷新页面。
- 弹窗：打开/关闭弹窗、消息提醒、确认弹窗。
- 表单：组件可见性、组件可用性、重置、清空、赋值、校验表单、校验表单项、提交。
- 其他：发送请求、打印、导出 PDF、抛出事件、复制内容、自定义操作、扩展自定义行为。

消息、确认、显隐、校验、请求、抛出事件和自定义操作均展示了与动作匹配的专用参数控件；每个动作还有“执行异常：继续/中断”“执行条件”和“阻断条件”。证据：[E03](./evidence/fc-07-category-其他.png)。

未验证：除请求测试器外，这些动作均未在运行态执行；“自定义操作”界面声明通过 JavaScript 实现，本项目明确不采纳该执行方式。

### 3. 条件、分支与嵌套

**状态：O。**

复现路径：事件流加号选择“条件” -> 点击优先级 1 条件 -> “逻辑条件”中添加条件组 -> 切换“计算公式”。

观察：添加条件会同时生成优先级分支和“其他情况”兜底分支；条件组可继续嵌套，并分别选择 AND/OR。左右操作数类型菜单出现“字段 / 变量 / 权限 / 角色”。计算公式页提供“当前表单”和数字、文本、时间、集合、逻辑、高级函数分类，并给出 `IF/GT/MUL` 形式的示例占位。条件成立后还可选择继续或中断动作。证据：[E04](./evidence/fc-condition-04-after-nested.png)、[E05](./evidence/fc-condition-05-formula.png)。

未验证：嵌套深度上限、复杂公式求值、权限/角色数据的宿主来源、条件错误诊断及序列化往返。

### 4. 字段、变量与上游结果引用

**状态：O（可发现入口及一次负向观察），I（对象属性语法说明）。**

复现路径：表单赋值动作选择目标组件 -> 将值从“静态”切到“表达式” -> 打开表达式编辑器；条件操作数切换到“变量”；请求动作后再打开下游动作表达式。

观察：目标字段通过组件名称选择；表达式树出现“当前表单 > 输入框 > ID”和函数分类；条件操作数可选“变量”并提供变量按钮。请求编辑器界面说明 `{{token}}` 和 `{{variableName.attributeName}}`，但本轮没有实际执行对象属性引用。请求动作生成了 `res_*` 结果名；随后打开的下游表达式树只显示当前表单字段和函数，没有显示该结果名。因此“结果名存在”已验证，“下游结果可发现选择”在该路径未验证，不能推断为支持。证据：[E06](./evidence/fc-expression-03-value-editor.png)。

未验证：变量声明/初值/重命名、对象数组路径选择、上游结果属性选择及引用维护。

### 5. 请求配置与显式测试

**状态：O。**

复现路径：“其他 > 发送请求 > 编辑请求” -> 输入 `https://jsonplaceholder.typicode.com/todos/1` -> GET -> “测试请求”。

观察：请求面板包含 GET/POST、JSON/FormData、请求头、请求参数、附带数据，以及“请求配置 / 前置处理 / 数据处理 / 错误处理”页签。测试器实际发出只读 GET，记录到 HTTP 200、1283 ms，并在面板显示返回 JSON。证据：[E07](./evidence/fc-request-01-editor.png)、[E08](./evidence/fc-request-02-test-success.png)。

未验证：POST/FormData、映射脚本、错误、超时、取消、乱序、鉴权和事件流中真实执行；页签存在不等于这些行为通过。

### 6. 子表单、嵌套与表格明细

**状态：O（基础设计和增删），I（高级配置入口）。**

复现路径：左侧“子表单组件”选择子表单 -> 拖入输入框作为子节点 -> 预览 -> 加号从 1 行增至 2 行 -> 减号恢复 1 行；另选“表格表单”预览并点击“添加”。

观察：产品提供“子表单 / 表格表单 / 表格表单 Pro / 嵌套表单 / 无限级表单”。子表单设计态可容纳字段，运行态每行有输入控件，已实测新增和删除；表格表单空态点击“添加”后出现带行号和输入框的行。配置界面还显示默认/最少/最多条数、操作按钮、排序按钮、允许新增/删除、过滤空行、嵌套层数等入口。证据：[E09](./evidence/fc-subform-child-design.png)、[E10](./evidence/fc-subform-op-02-after-add.png)、[E11](./evidence/fc-table-form-02-after-add.png)。

未验证：复制、拖动排序、数量边界、至少两层数据回填、行内事件/联动/校验作用域、错误定位、重置/只读及序列化往返；仅看到“嵌套/无限级”入口，不把名称当作两层运行验证。

### 7. 校验

**状态：O（规则目录与空值错误态）。**

复现路径：拖入输入框 -> “验证配置” -> 设置必填/打开“验证规则 +” -> 预览 -> 空值提交。

观察：规则菜单包含长度、最大/最小长度、正则、大小写、邮箱、URL、IP、手机号、最小/最大值、正负数、整数、数字、自定义验证及条件验证；预览中的必填字段空值提交后进入校验错误态。证据：[E12](./evidence/fc-validation-01-inline-rule.png)、[E13](./evidence/fc-validation-03-empty-submit.png)。

未验证：具体错误文案合同、触发时机、异步/跨字段/子表单校验、重复提交，以及隐藏/禁用/只读字段的提交语义。

### 8. 预览、生成与持久化

**状态：O（预览/生成视图与保存阻塞），U（导入和往返）。**

复现路径：顶部“预览” -> 切换表单/阅读、电脑/移动端，并打开“生成组件 / 生成 SFC / 生成 HTML / 生成 SQL”；返回设计器点击“保存”。

观察：预览弹窗确有上述模式和生成页签，生成组件页展示 Vue 使用代码。点击保存后出现“需要登录，登录后可以保存表单示例”，本轮按边界未登录。证据：[E14](./evidence/fc-export-生成组件.png)、[E15](./evidence/fc-save-dialog.png)。

未验证：导入、JSON 往返、保存重开、生成工程安装/构建，以及事件、数据源、校验和子表单在生成产物中的等价性。生成 SQL、打印和 PDF 也不属于批准合同的核心交付。

## VForm3Pro 实测

### 1. 产品身份、实际入口与全局能力

**状态：O（产品身份与工具栏），I（全局事件入口）。**

新增操作记录明确保存实际 URL `http://pro3.vform666.com/`、页面标题 `Variant Form 3 Pro`，界面显示 `VForm3 Pro`、`Ver 3.6.20`。工具栏可见 PC/Pad/H5、预览、导入 JSON、导出 JSON、导出代码和生成 SFC；其中预览、导入 JSON、导出 JSON 和生成 SFC 已在后续路径实际打开。全局设置列出 `onFormCreated`、`onFormMounted`、`onAfterSetFormData`、`onFormDataChange`、`onFormValidate`、`onFormUnmounted` 的“编写代码”入口，但没有执行这些事件。证据：[E16](./evidence/vf-datasource-01-tab.png)。

### 2. 命名数据源与隔离请求测试

**状态：O。**

复现路径：“数据源 > 新增数据源” -> 查看请求配置 -> 打开测试数据源 -> 立即执行；再新增请求头/参数/发送数据并展开类型菜单。

观察：数据源具有唯一名称、描述、请求地址、GET/POST/PUT/DELETE、headers/params/data；请求地址可选固定字符串或变量/表达式，参数值可选字符串、数值、布尔、变量/表达式。面板还显示数据处理、错误处理、多数据集配置和 DSV 数据源变量。测试时浏览器拦截了 `GET https://example.test/vform-datasource` 并返回隔离数组，结果区显示 `[{ id: 1, label: "isolated" }]`，控制台无记录错误。证据：[E17](./evidence/vf-datasource-02-new.png)、[E18](./evidence/vf-datasource-04-test-success.png)、[E19](./evidence/vf-datasource-08-parameter-types.png)。

限制：返回数据来自测试拦截，不证明该域名真实可用；数据/错误处理界面含任意代码编辑器，本项目不采纳该安全模型。未验证字段选项复用、级联更新、并发隔离和持久化。

### 3. 字段事件入口

**状态：O（编辑器与签名），I（事件未执行）。**

复现路径：拖入“单行输入” -> 组件“事件属性 > onChange > 编写代码”。

观察：字段列出 `onCreated/onMounted/onInput/onChange/onFocus/onBlur/onEnterKeyup/onValidate/onAppendButtonClick`，`onChange` 编辑器签名为 `(value, oldValue, subFormData, rowId)`，显式暴露子表单数据和行 ID。字段属性还显示必填、字段校验、只读、禁用和隐藏。证据：[E20](./evidence/vf-event-onchange-code.png)。

限制：该产品路径要求直接编写代码，没有观察到可视化动作/条件编排；字段事件没有实际触发证据。

### 4. 子表单拖入、预览与行增删

**状态：O（单行、多行、名为“嵌套子表单”的基础行行为；表格子表单完整增删与自然数组取数），U（真正两层嵌套）。**

复现路径：

1. 通过真实鼠标拖动，将左侧物料放到空画布 `.no-widget-hint`；容器出现后，再把“单行输入”拖到 `.sub-form-drag-drop-zone`、`.drag-drop-zone` 或 `.sub-form-table` 子投放区。
2. 分别预览单行、多行和名为“嵌套子表单”的组件，点击“新增”，再点击最后一行的删除按钮并在“删除行?”对话框确认。
3. 对表格子表单拖入输入字段，选择容器并预览，检查运行态控件。

观察：单行和多行子表单默认各有 1 行，新增一次后均变为 2 行，确认删除后恢复 1 行；名为“嵌套子表单”的组件默认 0 行，新增后为 1 行，确认删除后恢复 0 行。各路径的设计态都保存了容器内输入字段，证明不是只点击物料名称。删除路径会先显示“删除行?”确认框。证据：[E21](./evidence/vf-complete-rows-single-after-add.png)、[E22](./evidence/vf-complete-delete-confirm.png)、[E23](./evidence/vf-complete-rows-multi-after-add.png)、[E24](./evidence/vf-complete-delete-multi.png)、[E25](./evidence/vf-complete-rows-nested-after-add.png)、[E26](./evidence/vf-complete-delete-nested.png)。

早期 E27 已实际拖入表格容器和输入字段，但当时只保存初始预览；后续旧 context 中找不到空画布的重试属于取证限制，不是产品失败证据。原证据：[E27](./evidence/vf-complete-table-controls.png)。

**本次补测：O。** 在全新隔离 context 中，通过 `page.mouse` 多步拖动并等待拖拽开始，将“表格子表单”放到 `.no-widget-hint`，再将“单行输入”放入 `.sub-form-table`。预览初始为 1 行，点击圆形加号后为 2 行；填入 `TABLE-ROW-A` 和 `TABLE-ROW-B` 后点击“获取数据”，公开 JSON 为 `{"tablesubform104651":[{"input52899":"TABLE-ROW-A"},{"input52899":"TABLE-ROW-B"}]}`，通过 `JSON.parse`，不是扁平字段或行号文本推断。证据：[E33](./evidence/vf-supplement-final-table-two-row-data.png)。

关闭数据弹窗并悬停第二行输入框后，行删除按钮才从隐藏变为可见；正常点击后出现“删除行?”，确认后表格行 DOM 和输入框计数均恢复 1。再次“获取数据”仅剩 `{"tablesubform104651":[{"input52899":"TABLE-ROW-A"}]}`。证据：[E34](./evidence/vf-supplement-final-table-one-row-data.png)。`vf-supplement-final-run.json` 步骤 1-12 保存实际 URL、版本、逐步 UTC、拖动坐标、行数、解析值与截图哈希，完成 1 到 2 到 1 闭环。

未验证：复制、排序、数量上下限、稳定行标识、行内事件/联动/校验作用域、错误定位、数据回填，以及把子表单再放进子表单形成真正两层嵌套。产品组件名“嵌套子表单”不等于两层运行行为已通过。

### 5. 必填校验执行

**状态：O（必填开关与空值错误）。**

复现路径：真实拖入单行输入 -> 将“必填字段”从 `false` 切换到 `true` -> 打开预览 -> 保持空值点击“获取数据”。

观察：设计态开关值确实变为 `true`。运行态显示字段错误 `[input]不可为空`，操作记录同时捕获 `表单数据校验失败: ["input24417"]`。证据：[E28](./evidence/vf-complete-final-required-enabled.png)、[E29](./evidence/vf-complete-final-required-error.png)。

未验证：自定义/异步/跨字段/子表单校验、触发时机、隐藏/禁用/只读字段语义、错误聚合与重复提交。

### 6. 预览、JSON 对话框与 SFC

**状态：O（预览、完整 JSON 设计配置往返、往返后的字段/行操作及可见 SFC 生成结果），U（SFC 实际下载与可运行工程）。**

早期复现路径：拖入单行输入 -> “导出JSON”；关闭后打开“导入JSON”并尝试填入提取片段；另重新拖入单行输入 -> “生成SFC”。以下 E30-E32 保留当时结论，本次完整往返另列其后。

观察：

- 早期导出 JSON 对话框显示包含 `widgetList` 和输入组件信息的文本，以及“复制JSON / 保存为文件 / 关闭”控件。该次自动提取只得到约 568 个字符的可见片段且混入编辑器展示内容，无法解析为完整 JSON，不能单凭这一证据证明导出值有效或往返成功。证据：[E30](./evidence/vf-complete-final-export-json.png)。
- 导入 JSON 对话框实际打开，显示格式示例及“导入 / 取消”。尝试导入上述不完整片段后画布为空；输入本身不是有效 JSON，因此不能把该结果归为产品失败。HTTP 页面环境下 `navigator.clipboard.readText` 不可用，无法通过“复制JSON”取得完整值后重导。证据：[E31](./evidence/vf-complete-final-import-json-dialog.png)。
- 生成 SFC 对话框实际显示 Vue2/Vue3、`template`、`script`、`el-form`、`v-model`，以及复制 Vue2/Vue3 代码和保存 Vue2/Vue3 组件控件。可见代码生成已验证，但没有下载后安装、编译或运行独立工程。证据：[E32](./evidence/vf-complete-final-sfc-generated.png)。

**本次完整 JSON 往返：O。** 正式操作记录 `vf-supplement-json-scroll-run.json` 的时间为 19:37:31.840 至 19:37:42.984，产品仍为 `Ver 3.6.20`。复现路径：

1. 新 context 拖入表格子表单及一个输入字段，打开产品“导出JSON”。
2. 聚焦公开 Ace 文本输入，用 `Control+Home`、`PageDown` 翻页，按可见行号收集 `.ace_line` 文本。每轮行号与行文本一一对应，1-140 行无缺失或冲突，完整值为 3774 字节，`JSON.parse` 成功，根键为 `widgetList`、`formConfig`。页尾证据：[E35](./evidence/vf-supplement-scroll-export-before-end.png)；完整性和解析由步骤记录共同支持，不以单张页尾截图替代。
3. 关闭导出对话框，点击“清空”，本次直接得到空画布、表格计数 0；仅影响该隔离 context。
4. 打开“导入JSON”，在公开编辑器通过键盘输入上述原文，再点击“导入”。表格容器与输入字段恢复。证据：[E36](./evidence/vf-supplement-scroll-import-result.png)。
5. 再次通过产品“导出JSON”逐页取值，完整解析并递归比较对象键、保留数组顺序。结构与原文均一致：前后 SHA-256 均为 `2F291498951AF06E1D52D35C9DA13CCFB409E5C5607C177AD5552D952CC27D8A`，规范化结构 SHA-256 均为 `8F2CCFBAE8D7169D8E5644116084EC97FFEB22BD19E88F02B83E2AF28A67C8E8`。表格名 `tablesubform104368`、字段名 `input62345` 与 `table-sub-form -> input` 层级保持一致。
6. 导入后预览初始 1 行，填写 `ROUNDTRIP-A`；新增第二行填写 `ROUNDTRIP-B`。“获取数据”解析为 `{"tablesubform104368":[{"input62345":"ROUNDTRIP-A"},{"input62345":"ROUNDTRIP-B"}]}`。悬停第二行、删除并确认后恢复 1 行且保留 `ROUNDTRIP-A`。证据：[E37](./evidence/vf-supplement-scroll-preview-data.png)、[E38](./evidence/vf-supplement-scroll-preview-one-restored.png)。

边界：本次验证的是**设计配置**往返，不是将预览中填写的数据持久化；仅覆盖一个表格与一个输入字段，不扩展为所有事件、数据源、校验配置均等价。`vf-supplement-scroll-before.json`、`vf-supplement-scroll-after.json` 及 `*-pages.json` 只留在 scratch，均来自公开编辑器 DOM，不访问 Ace 实例、Vue 内部对象或应用私有函数。先前“保存为文件”会显示文件名提示，确认后 `download.saveAs` 报 `canceled`，因此不声称完成下载；取消原因未定位，不按产品缺陷定性。

可选方向限制：本次仅打开公开模板列表，看到单列、多列、分组、标签页、主从、响应式、问卷和固定表格八项；“嵌套子表单”定位命中隐藏的组件库条目，未加载真正两层模板，也没有两层运行数据结论。SFC 实际下载本次未完成，独立工程安装、解析、构建和运行均未执行，E32 仍只支持可见生成结果。

### 7. 仍未验证

**状态：U。**

- 动作分类、顺序动作、条件分支、阻断与错误策略；现有证据只看到代码事件入口。
- 真正两层嵌套、复制、排序和行作用域行为；表格基础新增/删除和自然数组取数已由 E33-E34 补齐。
- 保存重开、SFC 实际下载、导出代码与 SFC 独立构建；基础表格设计 JSON 同值往返和往返后运行操作已由 E35-E38 补齐。
- 变量引用维护、数据源到字段选项的复用、并发/取消/超时与运行 trace。

## 产品行为采纳决策

| 决策 | 产品证据 | 采纳方式或不采纳理由 |
| --- | --- | --- |
| 采纳事件就地入口 | FormCreate 表单/组件“设置事件” | 从表单生命周期和组件事件直接进入对应流程，入口锁定事件来源，避免用户先处理内部协议 |
| 采纳业务化顺序/分支模型 | FormCreate 开始、动作、条件、兜底、结束 | 常规流程用可排序步骤和嵌套条件表达，内部图结构仅为实现，不要求用户维护节点 ID/边 |
| 采纳分类动作与专用参数控件 | FormCreate 页面/弹窗/表单/其他及各动作参数 | 每个内置动作声明参数 Schema、输入来源和诊断；常规配置不使用 JSON 文本框 |
| 采纳安全表达式的可发现引用 | FormCreate 字段/变量/函数入口 | 提供字段、页面变量、事件参数、上游结果和对象/数组路径选择；表达式受限解析，不执行 JavaScript |
| 采纳命名数据源和显式测试器 | VForm3Pro 数据源；FormCreate 请求测试 | 数据源由页面声明并可供字段和动作复用；测试必须显式触发、使用可控请求，并展示加载/结果/错误 |
| 采纳子表单一等设计/运行模型 | FormCreate 子表单与表格明细；VForm3Pro 单行/多行/名为“嵌套子表单”的基础增删，以及表格自然数组、1 到 2 到 1 和 JSON 往返 | 对象、数组和表格明细使用行作用域和稳定行标识，覆盖新增、复制、删除、排序、数量约束及真正两层嵌套；不以组件名称替代运行验收 |
| 采纳预览中的校验和提交反馈 | 两产品的必填空值错误态 | 预览同时展示字段错误、提交状态和运行诊断，作为配置验证工具而非静态画布 |
| 不采纳任意 JavaScript | 两产品均提供代码编辑器 | 批准合同禁止 `eval`、`Function` 或等效入口；扩展仅通过显式注册、带参数元数据的可信宿主动作 |
| 不直接复制权限/角色模型 | FormCreate 条件操作数出现权限/角色 | 账号权限平台不在范围内；需要时由宿主提供只读上下文，不在表单内隐式实现 ACL |
| 不让设计操作自动触发副作用 | 两产品有请求、导航、打印等动作 | 请求、导航、消息、确认均经宿主能力边界执行；设计、导入和普通编辑不自动调用外部端点 |
| 不纳入 AI、打印、PDF、SQL、云示例保存 | FormCreate 对应入口 | 不属于批准的核心业务表单范围；本地持久化与独立 Vue 导出按合同验收，不复刻商业平台服务 |
| 不复制商业源码或视觉实现 | 两产品公开运行界面 | 只提炼行为合同和交互原则；正式交付仅保存公开页面截图，不保存或反编译商业源码 |

## 本地事实差距

以下是代码现状锚点，不是“已修复”声明。

| ID | 本地事实锚点 | 与产品证据的差距 | 关联 AC |
| --- | --- | --- | --- |
| G1 | [`FlowWorkspace/index.vue`](../../../../packages/ConfigForm/workbench/src/features/flow/components/FlowWorkspace/index.vue#L13) 使用通用 VueFlow；节点仍显示 Node ID，并在 300-310 行暴露“Node config”JSON 文本区。[`use-flow-graph.ts`](../../../../packages/ConfigForm/workbench/src/features/flow/components/FlowWorkspace/composables/use-flow-graph.ts#L56) 在编辑时 stringify/parse JSON。 | FormCreate 的常用动作和条件由业务控件完成；本地常规条件/reaction/动作仍可能要求 JSON 和内部概念。 | AC2、AC3、AC8、AC10 |
| G2 | [`use-flow-workspace.ts`](../../../../packages/ConfigForm/workbench/src/features/flow/components/FlowWorkspace/composables/use-flow-workspace.ts#L50) 每次有效修改立即发出 ProjectCommand；设置修改见 152-162 行，图/边/节点修改见 [`use-flow-graph.ts`](../../../../packages/ConfigForm/workbench/src/features/flow/components/FlowWorkspace/composables/use-flow-graph.ts#L96)。完整 `FlowWorkspace` 没有整场编辑的保存/取消控件。 | FormCreate 事件弹窗具有明确取消/保存/确定层级；本地缺少“取消不污染正式配置、保存只产生一次历史”的事务草稿边界。 | AC2、AC8、AC9 |
| G3 | [`model/src/types/contracts.ts`](../../../../packages/ConfigForm/model/src/types/contracts.ts#L173) 的 PageGraph 只有 props/form/root/nodes，ProjectPage 只有 graph/flows；没有页面变量或命名数据源合同。 | 产品提供变量引用和命名数据源；本地缺少可声明、复用、测试和持久化的页面级所有权。 | AC3、AC5、AC9、AC11 |
| G4 | [`ActionInputs/index.vue`](../../../../packages/ConfigForm/workbench/src/features/flow/components/FlowWorkspace/components/ActionInputs/index.vue#L14) 提供顶层 Field/Output 选择，但 Event/Expression 和非枚举值落到自由文本输入（81-89 行）；输出候选只是其他动作节点 ID（[`FlowWorkspace/index.vue`](../../../../packages/ConfigForm/workbench/src/features/flow/components/FlowWorkspace/index.vue#L289)）。 | 缺少字段/变量/事件参数/上游结果的对象属性和数组索引浏览器；常用引用不可发现且易写错。 | AC2、AC3、AC5、AC6 |
| G5 | [`source-page.ts`](../../../../packages/ConfigForm/workbench/src/project/export/services/source-page.ts#L20) 只从静态 `props.options` 收集选项，并在 34-42 行删除 `optionSource`。 | 独立源码生成会丢失动态 optionSource 语义，不能满足设计/预览/导出等价。 | AC5、AC9、AC10 |
| G6 | [`constants/preview.ts`](../../../../packages/ConfigForm/workbench/src/session/constants/preview.ts#L1) 将 trace 上限设为 200；[`session/services/preview.ts`](../../../../packages/ConfigForm/workbench/src/session/services/preview.ts#L207) 确实收集并截断。完整 [`PreviewDrawer/index.vue`](../../../../packages/ConfigForm/workbench/src/app/components/PreviewDrawer/index.vue#L119) 只展示预览与提交结果，没有 trace 视图。 | 运行信息已缓存但用户无法查看节点顺序、输入输出、耗时和错误定位。 | AC4、AC10 |
| G7 | [`model/src/types/contracts.ts`](../../../../packages/ConfigForm/model/src/types/contracts.ts#L157) 的 PageNode 仅区分 FieldNode/LayoutNode，当前合同没有一等对象/数组行及稳定行作用域；G4 的选择器也无数组寻址。 | 两产品均已展示基础数组子表单增删，FormCreate 另有表格明细新增；本地仍需完整对象/数组/表格数据合同。 | AC6、AC7、AC9、AC10 |
| G8 | [`use-flow-workspace.ts`](../../../../packages/ConfigForm/workbench/src/features/flow/components/FlowWorkspace/composables/use-flow-workspace.ts#L124) 的当前入口标签只处理组件事件、page.mount 和 form.submit。 | FormCreate 表单事件目录还覆盖重置、初始化、卸载、重载、值变化、验证通过和请求前等入口；本地入口矩阵不足。 | AC3、AC4、AC7、AC10 |

## AC1-11 关联

| AC | 本研究提供的依据 | 当前结论 |
| --- | --- | --- |
| AC1 | 两个实际产品的元信息、步骤、观察、限制与 38 张正式截图 | **部分满足**；VForm3Pro 表格增删与 JSON 往返已补齐，动作/条件、真正两层及可运行导出仍缺，不标完成 |
| AC2 | FormCreate 就地事件入口、顺序动作、嵌套条件、兜底、继续/阻断 | 支持重做业务化编辑器；G1/G2 仍是本地差距 |
| AC3 | 两产品事件目录，FormCreate 动作目录和宿主扩展入口 | 支持生命周期/动作矩阵；任意 JS 不采纳，G8 未修复 |
| AC4 | FormCreate 的异常继续/中断、阻断条件、显式请求测试 | 产品证据未覆盖并发/取消/超时；本地 G6 trace 无 UI |
| AC5 | FormCreate 字段/变量入口与请求，VForm3Pro 命名数据源/测试/类型 | 支持页面变量和共享数据源设计；G3-G5 未修复 |
| AC6 | FormCreate 基础子表单/表格增删；VForm3Pro 基础子表单增删及表格自然数组、完整 1 到 2 到 1 | 依据增强；真正两层、排序、行作用域仍未验证，G7 为原报告的本地差距，本次未修改业务源码 |
| AC7 | 两产品均有必填空值错误实测；FormCreate 另有规则目录 | 仅基础依据；异步/跨字段/子表单及状态语义仍未验证 |
| AC8 | 两产品的实际拖入、预览路径及配置入口 | 可用于交互设计；没有验证本地视口、键盘、撤销或错误恢复 |
| AC9 | FormCreate 多生成视图；VForm3Pro 基础表格设计 JSON 同值往返、往返后运行与可见 SFC 结果 | 竞品基础 JSON 往返已通过；不代表全能力导出等价、SFC 独立构建或本地 G5 已通过 |
| AC10 | 请求、明细、校验可作为三类业务场景输入 | 没有任何本地场景或质量命令因此被标为通过 |
| AC11 | 采纳/不采纳理由明确了安全表达式、宿主动作、数据源和子表单边界 | 为后续文档提供决策输入，不代表架构/API 文档已经更新 |

## 后续证据缺口

1. VForm3Pro：补测动作/条件、真正两层嵌套、保存重开、数据源字段复用及 SFC 实际下载/导出代码独立构建；本次基础表格增删、自然数组取数和设计 JSON 同值往返已完成，不再列为相同缺口。
2. FormCreate Pro：补测导入、保存重开（需在不违反账号边界的可用环境）、上游结果选择、两层嵌套、排序/复制和失败请求。
3. 两产品：均未覆盖并发、取消、超时、重入保护、完整 trace 或导出工程构建；这些必须由本地可控自动化验收，不可从竞品入口推断。
