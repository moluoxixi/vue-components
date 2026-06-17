# 契约提取引擎替换：vue-docgen-api → vue-component-meta

状态：设计待确认 | 变更级别：L2（替换核心解析引擎 + 数据模型增量 + extractor 架构调整）

## 1. 背景与动机

`ai-doc-assistant` 当前用 `vue-docgen-api`（babel/正则语法层抽取）+ 自研 TypeScript Compiler API 类型展开层（`type-resolver.ts` / `external-type-resolver.ts`）提取组件契约。根本痛点：vue-docgen 不走 type checker，导致：

- `defineProps<导入接口>()` 的 prop 类型报 `unknown`，靠手写 `backfillPropTypesFromInterface` 回填
- `Omit/Pick/Partial` 别名展不开，靠手写 `resolveNamedTypeFields` / `resolveTypeNodeFields` 模拟工具类型
- 第三方类型（element-plus `PopoverProps`）拿不到字段，靠手写 `external-type-resolver` 跟 import 图
- 动态插槽 `#[name]` 被误报为伪插槽

这套手写类型解析约 530 行（type-resolver 320 + external-type-resolver 217），是 bug 高发区，且能力上限受限于语法层猜测。

## 2. Spike 实证结论（已验证，非推测）

在真实组件 `PopoverTableSelect` + 四宏 fixture 上验证 `vue-component-meta@3.1.8`（对齐 catalog 内 `@vue/language-core ~3.1.8`）：

### 2.1 四宏解析能力矩阵

| 宏 | vue-component-meta 实测 | 处置 |
|---|---|---|
| defineProps | `columns: PopoverTableColumn[]`、`Omit<...>` 别名全解析，含 required/default | ✅ 采用 meta |
| defineEmits | `select: [row: PopoverTableRow]` 带 payload 类型 | ✅ 采用 meta |
| defineModel | props + `update:xxx` events 双向体现 | ✅ 采用 meta，ModelDef 从 update 派生 |
| defineSlots（具名） | `default: { row }`、`header: { column }` 含作用域类型 | ✅ 采用 meta |
| defineSlots（动态键 `[name: string]` / 模板字面量） | **丢弃** | ❌ 保留后处理从 `<Comp>Slots` 契约补 |
| defineAttrs | **完全不体现** | ❌ 新增 SFC 提取器 |
| $attrs 转发 | meta 不跟 `v-bind="$attrs"`，父组件丢 columns/data | ❌ 保留 `mergeForwardedSubComponent` |

### 2.2 性能与体积

- `createChecker`：~20ms；首个组件 `getComponentMeta`：~4.6s（建 program）；后续组件：~15ms。批量提取复用单一 checker 实例。
- 体积关键风险：默认全量 schema 展开 = **66MB~191MB**（`Partial<PopoverProps>` 递归展开整个 element-plus + DOM 类型宇宙）。
- 解法验证：`schema.ignore` 模式匹配（`/Props$/`、`/Instance$/`、`Partial`、DOM 类型等）在第三方边界停止展开，自有类型（`ThrottleOrDebounceOptions` 的 leading/trailing/promise）完整保留 → **降到 18KB**。等价于现有"深度1层、第三方留字符串"策略，但改为声明式配置。

## 3. 替换边界

### 3.1 替掉
- `vue-docgen-api` 调用（extractor.ts 的 `parse`）
- `type-resolver.ts` 全部（defineProps 泛型回填、Omit/Pick 模拟、SFC 内联别名解析）
- `external-type-resolver.ts` 全部（import 跟随、barrel re-export、element-plus 入口解析）

### 3.2 保留（meta 能力盲区，实证确认）
- `deriveSlotsFromContract`：从 `<Comp>Slots` 契约接口派生**动态插槽** `[dynamic]` 说明，降级为"只补 meta 未给出的动态部分"
- `mergeForwardedSubComponent`：`v-bind="$attrs"` 定向转发子组件契约合并
- `component-discovery.ts`：组件发现/命名，不动

### 3.3 新增
- `meta-extractor.ts`：封装 createChecker（单例复用）+ schema.ignore 配置 + getComponentMeta
- `defineAttrs` 提取器：从 SFC 抽 `defineAttrs<T>()` 泛型名，复用类型展开拿 T 字段
- 适配层：meta 嵌套 schema 树 → 拍平回现有 `ComponentContract` / `TypeDefInfo` 扁平结构

## 4. 数据模型增量（向后兼容，全部可选字段）

```
PropDef:
  + forwardedFrom?: string   // $attrs 定向转发来源组件名（UI 角标）

ComponentContract:
  + attrs?: TypeFieldDef[]    // defineAttrs<T> 声明的开放透传属性（新段）
  + exposed?: ExposeDef[]     // defineExpose / meta.exposed（新能力，现状完全没有）

protocol wire 镜像同步加可选字段：PropWire.forwardedFrom?、ComponentDetailResponse.attrs?/exposed?
```

下游 DetailView/indexer/context/protocol 现有字段形状不变 → 零破坏，仅新增可选渲染段。

## 5. $attrs 呈现设计（用户确认采用）

- **定向转发（PopoverTableSelect→Base）**：转发 props 合并进主 props 表 + `forwardedFrom` 角标。一等公民 prop，类型/默认值/字段展开齐全，使用者无感。
- **defineAttrs 开放透传**：单独 `attrs` 段展示 T 字段类型，不混入 props 表。
- 两者皆无：不显示 attrs 段。

## 6. 适配层策略（保持 ComponentContract 外形）

meta 的嵌套 `schema`（`kind: object/enum/array`，递归 `schema` 子树）拍平为现有扁平 `TypeDefInfo[]`：
- 遍历 meta.props 的 schema 树，对 `kind:object` 节点产出一个 `TypeDefInfo`（name + fields + raw）
- prop 的 `typeRefs` 从 schema 树 object 节点名收集
- schema.ignore 截断的第三方类型 → 无 object 节点，typeRefs 不含它，行为等价现状"留类型字符串"
- 可达性裁剪由 schema.ignore + 树遍历天然完成，`filterReachableDefs` 逻辑内化

## 7. 测试分层

### 7.1 单元（Vitest，packages/ai-doc-assistant/__tests__/）
- `meta-extractor.test.ts`：四宏 fixture 矩阵
  - defineProps 泛型/Omit/Pick 类型解析正确
  - defineEmits payload 类型
  - defineModel → props + update events
  - defineSlots 具名 + 作用域类型
  - defineSlots 动态键被 meta 丢弃 → 后处理补全断言
  - defineAttrs 提取断言
- `meta-adapter.test.ts`：schema 树拍平回 TypeDefInfo 的等价性
- **体积上限断言**：序列化契约 < 50KB（防 schema.ignore 配置回退导致体积爆炸的护栏）
- `forwarding.test.ts`：$attrs 转发合并 + forwardedFrom 角标
- 保留并改造 `type-resolver.test.ts` → 迁移为 meta-extractor 等价断言（columns 展开、可达性裁剪）

### 7.2 回归
- 现有 `extractor-fixes.test.ts`、`detail-view.test.ts`、`demo-preview.test.ts`、`context.test.ts` 全绿（适配层保证）

### 7.3 端到端
- 真实组件 `PopoverTableSelect` 提取 → 契约含 columns/data（转发合并生效）+ 类型展开 + 体积达标

## 8. 风险点

| 风险 | 缓解 |
|---|---|
| schema.ignore 配置遗漏导致体积爆炸 | 体积上限断言做护栏；ignore 模式集中配置可审计 |
| 首组件 4.6s 建 program 拖慢冷启动 | 单例 checker 复用；批量提取仅付一次；buildIndex 本就异步状态机 |
| 组件 slot 写法本身未接 defineSlots（PopoverTableSelect 用 Record 索引签名，真实契约游离） | 本次不改组件库；后处理从 `<Comp>Slots` 接口补；另行建议修组件契约 |
| meta 版本与 @vue/language-core 漂移 | 锁 3.1.8 对齐 catalog；纳入 catalog 统一管理 |
| tsconfig 解析失败导致 meta 报错 | extractor 显式抛带文件上下文错误，不静默吞 |

## 9. 待确认项

1. 组件库 slot 契约游离问题（PopoverTableSelect 的 `defineSlots<Record>` 未接真实 `<Comp>Slots`）——本次只在 ai-doc 侧后处理兜底，是否另起任务修组件库本体？
2. `exposed` 新能力是否本次纳入 UI 展示，还是仅提取入契约、UI 后续迭代？
