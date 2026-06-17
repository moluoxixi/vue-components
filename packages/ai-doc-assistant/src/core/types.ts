/**
 * 组件契约领域模型：extractor 的产出、generator/indexer 的输入。
 * 字段口径对齐 docs/plan/backend「数据模型」节，以组件源码为权威来源。
 */

/** 单个 Prop 定义。 */
export interface PropDef {
  name: string
  type: string
  required: boolean
  defaultValue: string | null
  description: string
  /**
   * 该 prop 类型引用的项目内自定义类型名（已剥离 []、Partial<>、| null 等修饰）。
   * 用于在契约中关联展开 typeDefs，让结构化 prop（如 columns: PopoverTableColumn[]）
   * 的字段结构对模型可见。空数组表示该 prop 为基础类型或外部类型，无需展开。
   */
  typeRefs: string[]
  /**
   * 该 prop 经父组件 `v-bind="$attrs"` 定向转发自哪个内部子组件（如 'PopoverTableSelectBase'）。
   * 对使用者而言它是父组件对外 API 的一等公民 prop，UI 以来源角标提示其出处。
   * undefined 表示父组件自身显式声明的 prop。
   */
  forwardedFrom?: string
}

/** 自定义类型（interface / type alias）的单个字段定义。 */
export interface TypeFieldDef {
  name: string
  type: string
  optional: boolean
  description: string
}

/**
 * 展开的自定义类型定义：承载 prop 类型引用的项目内 interface / type alias 的字段结构。
 * 这是方案 A 的核心产出——vue-docgen-api 只给出类型名，此处补齐字段明细，
 * 使「columns 这一列怎么配」这类问题在知识库中有据可依。
 */
export interface TypeDefInfo {
  name: string
  /** interface 或 type-alias。 */
  kind: 'interface' | 'type'
  /** 结构化字段（interface 或对象字面量 type alias 才有）。 */
  fields: TypeFieldDef[]
  /** 类型定义原文（含 JSDoc），作为字段抽取的兜底与全文检索语料。 */
  raw: string
}

/** 单个事件（emit）定义。 */
export interface EmitDef {
  name: string
  payloadType: string
  description: string
}

/** 单个插槽定义。 */
export interface SlotDef {
  name: string
  scopeType: string
  description: string
}

/** v-model 绑定定义。 */
export interface ModelDef {
  name: string
  type: string
  description: string
}

/** defineExpose / 组件实例对外暴露的成员定义。 */
export interface ExposeDef {
  name: string
  type: string
  description: string
}

/** 组件契约：一个组件的完整对外契约。 */
export interface ComponentContract {
  name: string
  packageName: string
  description: string
  props: PropDef[]
  emits: EmitDef[]
  slots: SlotDef[]
  models: ModelDef[]
  sourceFile: string
  /**
   * 展开的关联类型定义（去重）：props 引用的项目内自定义 interface / type 的字段结构。
   * 让结构化 prop 的字段口径在知识库中可追溯（方案 A）。
   */
  typeDefs: TypeDefInfo[]
  /**
   * `defineAttrs<T>()` 声明的开放透传属性字段。组件把任意原生/额外属性透传到内部元素时，
   * 这里给出其类型契约，UI 单独成段展示（不混入 props 表）。undefined 表示组件未显式声明。
   */
  attrs?: TypeFieldDef[]
  /**
   * `defineExpose` / 组件实例对外暴露的成员（来自 meta.exposed）。空或 undefined 表示无对外暴露。
   */
  exposed?: ExposeDef[]
}
