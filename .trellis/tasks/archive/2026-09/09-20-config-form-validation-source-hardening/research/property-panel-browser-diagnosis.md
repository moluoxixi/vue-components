# 属性面板浏览器诊断

## 结论

属性面板存在两条互相独立、均可稳定复现的故障。它们不是测试环境偶发问题，也不能只靠调整 Required UI 修复。

## 故障一：校验编辑后整个设计面消失

### 复现

1. 创建 Element Plus Profile 项目。
2. 在 Layers 中选择 `Name`，打开 Validation，启用校验，再添加默认规则。
3. 或选择布尔字段 `Active`，直接启用校验。
4. 或添加 Number 字段、设置数字默认值，再启用校验。

Name 添加 Required 后、Boolean/Number 启用校验后，`.mx-config-form-design-surface`、Inspector 和属性页签均从 DOM 消失。Boolean 路径还可触发 Element Plus 在已销毁节点上写 `checked` 的异常。

### 根因链

- `DesignerValidationSetter/index.vue` 对未配置校验的字段固定初始化 `base: { type: 'string' }`，且 `DesignerSetter` 未向它传入 Material 的 `valueKind`。
- 属性提交经过 Designer command、Project editor session 和 Model transaction 后同步发布；Model 接受该 RuleSet。
- Vue backend 会把默认值套入完整业务规则进行编译期校验。空字符串不满足 Required、布尔/数字不满足 string base 时，Runtime artifact 编译失败。
- `createWorkbenchDesignSession.accept()` 在失败时把 `runtime.value` 清空；Workbench 又以 `currentGraph && designRuntime` 作为整个 `DesignSurface` 的挂载条件，因此 Canvas、Selection 和 Inspector 一起卸载。
- command execute 在同步订阅完成后用空 command diagnostic 覆盖 compile diagnostic，所以部分路径既白屏又没有可见错误。

### 设计要求

- 通用校验的初始 base 从 Material 的显式 value kind 投影；不支持的值类型不得伪装成 string。
- Required、长度、范围等业务规则不用于否决初始值的 artifact 编译；基础值类型不匹配仍可诊断。
- Runtime artifact 编译失败不得决定作者界面的挂载；保留最后一次成功 artifact 和当前图，并显示当前诊断。
- command diagnostic 与 compile diagnostic 分开拥有，undo/redo/jump 同样不能清空同步产生的编译错误。

## 故障二：修改默认值触发 DataCloneError

### 复现

选择 Name 字段，在 Properties 中把 Default value 改成 `Ada` 并提交。Runtime iframe 显示：

```text
RUNTIME_RENDER_FAILED: Failed to execute 'structuredClone' ... (watcher callback)
```

### 根因链

- `use-runtime-host-protocol.ts` 使用深响应式 `ref<ModelJsonObject>` 保存已经克隆的 plain JSON。
- Vue 将赋入对象深度代理；Runtime Host 随后通过 model port 把 Proxy 交给 Headless/Core。
- Core 的 JSON clone/value-scope 路径调用原生 `structuredClone`，浏览器拒绝克隆 Vue Proxy。
- Experience renderer 已使用 `shallowRef`，证明正确边界模式已存在。

### 设计要求

- Runtime Host 的 JSON 模型改用 `shallowRef`，每次赋值仍通过 `cloneWorkbenchJson` 建立 plain-data 边界。
- Core/Headless 不依赖 Vue，也不通过 `toRaw` 修补调用方泄漏的 Proxy。

## 回归矩阵

- Element Plus 与 Ant Design Vue 均执行连续属性操作。
- Text：空默认值、Required、required message、validateOn、规则增删和切页。
- Boolean：启用校验时 base 为 boolean，设计面不卸载。
- Number：数字默认值与 min/max 规则稳定。
- Select/Checkbox：只开放模型可准确表达的规则；Required 对空数组有效。
- 修改默认值后检查主页面、所有 Runtime iframe 的 alert、`console.error` 和 `pageerror`。
- 等待自动保存并重载，确认项目仍可打开、选择字段并继续修复。

## 补充审计：Properties 与 Options

### 被拒绝命令造成控件假状态

`DesignerPropertyForm` 只在上游 projected model 变化时回填本地控件。命令被拒绝时 graph 不变，watch 不会再次运行。浏览器实测清空 Name 的 Field 并提交后，状态栏正确显示 `Field cannot be unset.`，但输入框保持空白，真实模型仍是原字段名。重复字段等拒绝路径同样存在 UI 与模型分叉风险。

修复要求：命令完成后必须以 command result 或权威 graph revision 收敛本地控件；失败时保留诊断并显式回滚，不能依赖值变化触发 watch。

相关文件：

- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel/components/DesignerPropertyForm/index.vue`
- `packages/ConfigForm/designer/src/graph/services/commands.ts`

### Options 与默认值引用不完整

Options setter 只提交 `props.options`，不会同步检查字段 `defaultValue`。Registry analyzer 已能识别默认值不在 options 中，但 Designer 主控制器关闭了这类默认值诊断。删除或修改已选 option 后，模型保留旧默认值，画布控件显示空白且没有解释。

需要由产品确定一个原子策略：同步清除受影响默认值并提示，或拒绝 option 修改并要求先处理引用。无论选择哪种，都不能发布悬空状态。

相关文件：

- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel/components/DesignerOptionsSetter/index.vue`
- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel/composables/use-designer-property-entries.ts`
- `packages/ConfigForm/designer/src/registry/services/analyze.ts`
- `packages/ConfigForm/designer/src/composables/use-designer-controller.ts`

### 合法值被误当作删除

Options 编辑器允许文本 option 的 value 为 `''`，但通用与 Element 默认值 setter 都将 `''` 转成 `undefined`。这使合法业务选项无法保存为默认值。删除必须由显式 clear intent 表达，不能通过值的 truthiness 或空字符串猜测。

相关文件：

- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel/components/DesignerDefaultValueSetter/index.vue`
- `packages/ConfigForm/designer-element-plus/src/materials/components/ElementDefaultValueSetter/index.vue`

### Provider option 类型能力不一致

通用 Options 编辑器开放 boolean value，但 Element Checkbox、Ant Checkbox 与 Ant Select 会过滤 boolean，形成“配置存在、默认值可引用、画布不可见”的数据。Material/Provider 必须声明可用 option value 类型，Options 和默认值 setter 共同消费该能力。

### 额外高频编译触发器

- Rule 下拉当前对所有 base 开放全部规则，Boolean 可选择 `minLength`、String 可选择 `min`。
- Regex source/flags 每次按键立即写入 Model，`[` 或临时重复 flag 等正常中间态会进入编译链。

二者都必须通过 base-specific rule allowlist 和本地 draft/合法提交点修复。

### 扩展浏览器矩阵

- Text：Field 空值/重复值拒绝回滚、regex 中间态、规则增删、页签切换触发 blur。
- Number：`0`、负数、清空默认值、min/max/multipleOf 和非法中间输入。
- Select/Radio：空字符串、number、boolean option，增删改排序及默认值引用同步。
- Checkbox/Multiselect：空数组、多个默认值、删除已选 option、禁止不可渲染 boolean，只开放 Required。
- 每一步覆盖双 Provider、undo/redo、自动保存/重载，并断言主页面与所有 iframe 无 console error/pageerror。

## 相关文件

- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel/components/DesignerValidationSetter/index.vue`
- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel/components/DesignerSetter/index.vue`
- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel/composables/use-designer-property-entries.ts`
- `packages/ConfigForm/vue-backend/src/services/compile.ts`
- `packages/ConfigForm/workbench/src/session/services/workbench-design.ts`
- `packages/ConfigForm/workbench/src/app/index.vue`
- `packages/ConfigForm/workbench/src/runtime-host/composables/use-runtime-host-protocol.ts`
- `packages/ConfigForm/workbench/e2e/interaction.spec.ts`
