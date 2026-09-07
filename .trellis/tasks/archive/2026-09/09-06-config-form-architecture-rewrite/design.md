# 技术设计

## 新边界

```text
ProjectDocument / PageGraph
  -> Compiler CanonicalFieldDescriptor
  -> Runtime Host contract
  -> provider renderer
```

Designer 只负责 graph、selection、overlay、commands 和 Host metadata；真实 Vue Renderer 由 Host adapter 装配。Runtime controller 通过必传同步 `model: { read, write }` 读写，不保存第二份完整值对象。Vue 入口的 `read()` 读取响应式状态，`write()` 返回前必须提交完成；`createConfigFormModel(ref)` 提供标准连接方式。

## 硬切策略

- 删除 Designer 对 `ConfigFormRenderer`、Runtime 组件目录和 Runtime 私有类型的直接导入。
- Canvas 使用必传 `runtime` 与 `dragVisual` 插槽，Workbench 装配具体 Vue backend；Inspector renderer 由宿主显式注入。
- 把字段默认值、validation、validateOn、binding projection 的语义集中到 Compiler descriptor；Runtime 只做 provider binding 适配。
- 删除旧测试中对内部 model 镜像的假设，新增单值源、stale validation 和 Host contract 测试。

## 执行与生命周期

- `ConfigForm` 保留插件预处理职责，所有执行进入 `ConfigFormRenderer` 和 Headless controller。插件先完整转换包含嵌套 slots 的树，再接入 readonly adapters；每个节点只转换一次。
- Core 拥有 validateOn 归一化与响应式布局纯规则；Compiler 的完整和增量路径共享 CanonicalFieldDescriptor 构造。编译器版本升为 `3.0.0`，清除旧产物语义。
- Host Flow states 参与 Headless 的有效字段状态、动态 required、校验与提交判断。值、只读状态、Flow states 变化和 Renderer 卸载使未完成校验失效。
- Source 只使用 Canonical 默认值与绑定事件，不猜测缺省值或替代字段 key。异步结果检查请求 identity、模型快照、状态投影 revision 与页面 lifetime。
- 删除旧 useForm/FormContext/RecursiveField/FormLayout、specimen 组件与样式、本地 Canvas editor bridge 和 DOM clone fallback。现役四个 catalog seed 保持有效。

## 验证设计

执行测试直接编译同一项目，挂载 Vue backend 与生成 Vue SFC，比较字段默认值、事件、触发校验、reaction 和只读状态。异步验证使用可控 Promise 检查竞态；架构测试解析 TypeScript/Vue 依赖图，独立包消费者检验真实发布入口。

## 不做

- 不保留旧 import 路径或 deprecated alias。
- 不实现迁移器或双协议解析。
- 不改变当前版本号含义；若类型或协议变化，所有 producer/consumer 同批更新。
