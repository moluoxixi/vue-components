/**
 * 前后端共享协议层：请求/响应类型、SSE 事件、错误码常量、SSE 编解码。
 * 本模块零运行时副作用、不依赖 node/vue，供 server 与 ui 双向引用。
 */

/** 检索无命中阈值：top1 归一化 score 低于此值视为无依据，触发兜底（不输出示例）。 */
export const NO_MATCH_SCORE_THRESHOLD = 0.3

/** BFF 统一 API 前缀。 */
export const API_PREFIX = '/__ai-doc/api'

/** 索引状态机的四个状态。 */
export type IndexState = 'not_built' | 'building' | 'ready' | 'stale'

/** 统一错误码。 */
export type ApiErrorCode
  = | 'INVALID_REQUEST'
    | 'NOT_FOUND'
    | 'INDEX_NOT_READY'
    | 'UPSTREAM_ERROR'
    | 'INTERNAL_ERROR'

/** 错误码 → 默认 HTTP 状态映射。 */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  INDEX_NOT_READY: 409,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
}

/** 统一错误响应体。 */
export interface ApiErrorBody {
  error: ApiErrorCode
  message: string
}

/** POST /query 请求体。 */
export interface QueryRequest {
  question: string
  topK?: number
}

/** 检索命中的来源引用（回传给前端做可追溯展示）。 */
export interface SourceRef {
  component: string
  packageName: string
  docPath: string
  score: number
}

/** GET /index/status 响应体。 */
export interface IndexStatusResponse {
  state: IndexState
  builtAt: string | null
  stale: boolean
  componentCount: number
}

/** POST /index/build 请求体。 */
export interface BuildIndexRequest {
  force?: boolean
}

/** GET /components 单条目。 */
export interface ComponentListItem {
  name: string
  packageName: string
  propsCount: number
  docPath: string
}

/** 单个 prop 的 wire 形态（用于组件详情）。 */
export interface PropWire {
  name: string
  type: string
  required: boolean
  defaultValue: string | null
  description: string
  /** 该 prop 类型引用的项目内自定义类型名（关联 typeDefs）。 */
  typeRefs: string[]
  /** 经父组件 `v-bind="$attrs"` 定向转发自哪个内部子组件（UI 角标）。缺省为父组件自身声明。 */
  forwardedFrom?: string
}

/** 单个 emit 的 wire 形态。 */
export interface EmitWire {
  name: string
  payloadType: string
  description: string
}

/** 单个 slot 的 wire 形态。 */
export interface SlotWire {
  name: string
  description: string
}

/** 单个 v-model 的 wire 形态。 */
export interface ModelWire {
  name: string
  type: string
}

/** 自定义类型字段的 wire 形态。 */
export interface TypeFieldWire {
  name: string
  type: string
  optional: boolean
  description: string
}

/** 展开的自定义类型定义 wire 形态。 */
export interface TypeDefWire {
  name: string
  kind: 'interface' | 'type'
  fields: TypeFieldWire[]
  raw: string
}

/** defineAttrs 开放透传属性字段的 wire 形态。 */
export interface AttrWire {
  name: string
  type: string
  optional: boolean
  description: string
}

/** defineExpose / 组件实例对外暴露成员的 wire 形态。 */
export interface ExposeWire {
  name: string
  type: string
  description: string
}

/**
 * GET /components/:name 响应体——单组件完整契约。
 * 供详情页渲染 props / emits / slots / v-model 表格与展开的关联类型结构。
 */
export interface ComponentDetailResponse {
  name: string
  packageName: string
  description: string
  docPath: string
  props: PropWire[]
  emits: EmitWire[]
  slots: SlotWire[]
  models: ModelWire[]
  typeDefs: TypeDefWire[]
  /** `defineAttrs<T>()` 声明的开放透传属性字段；缺省表示组件未声明。 */
  attrs?: AttrWire[]
  /** `defineExpose` / 组件实例对外暴露成员；缺省表示无对外暴露。 */
  exposed?: ExposeWire[]
}

/** 检索模式：content=结构化关键词 topK（默认）；vector=向量语义检索（可选增强）。 */
export type RetrievalModeWire = 'content' | 'vector'

/**
 * GET /health 响应体——provider 仅暴露配置态，绝不返回密钥。
 * mode 暴露当前检索模式；vector 模式 embedding 走本地模型、无需远端密钥，
 * 故不再暴露 embedding 密钥配置态（避免误导，本地路径恒可用）。
 */
export interface HealthResponse {
  ok: boolean
  providers: {
    chat: 'configured' | 'missing'
  }
  /** 当前检索模式。 */
  mode: RetrievalModeWire
  index: IndexState
}

/**
 * SSE 事件协议。query 接口按 sources → token* → example? → done 顺序推送；
 * 任意阶段出错推 error 后结束。
 *
 * example 事件携带 demo 预览块所需信息：
 * - code：向后兼容字段，等于首个可渲染块的 ts（老前端只读 code 仍可用）
 * - ts/js：首个可渲染块的双语言源码，供预览块切换查看/复制
 * - component/packageName：运行时编译挂载真实组件时需要（注入 moduleCache 解析本地组件库）
 * - blocks：从 LLM 回答提取的全部 vue 代码块（按出现顺序）。每块带 renderable 标志——
 *   true 表示 import 仅用预览环境可解析的依赖（vue + @moluoxixi/components），前端编译挂载；
 *   false 表示 AI 标了 no-demo 或引入了白名单外依赖，前端仅展示源码 + 复制 + reason，不挂载。
 *   blocks 为新链路主字段；code/ts/js 仅为兼容旧前端而保留（指向首个可渲染块，无则指向兜底骨架）。
 */
export interface ExampleBlock {
  /** 代码块源码（来自 LLM 回答的 vue fenced 块原文，通常含 lang="ts"）。 */
  ts: string
  /** JS 版本源码：仅当 LLM 另给了独立 JS 版本时存在；缺省表示无独立 JS（前端隐藏 JS 切换，不伪造降级）。 */
  js?: string
  /** 能否转 demo 预览块。 */
  renderable: boolean
  /** 不可渲染原因（renderable=false 时必有）。 */
  reason?: string
}

export type SseEvent
  = | { type: 'sources', sources: SourceRef[] }
    | { type: 'token', text: string }
    | {
      type: 'example'
      code: string
      lang: string
      ts: string
      js: string
      component: string
      packageName: string
      /** 全部提取块（新前端按此渲染多个示例；旧前端忽略，读 code/ts/js）。 */
      blocks: ExampleBlock[]
    }
    | { type: 'done' }
    | { type: 'error', error: ApiErrorCode, message: string }

/**
 * 把 SSE 事件编码为 wire 格式。
 * 采用 `event:` + `data:`（JSON）两行 + 空行的标准 SSE 帧。
 */
export function encodeSseEvent(event: SseEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * 从单个 SSE 帧文本解析出事件对象。无法解析时返回 null（调用方决定如何处理）。
 * 仅解析 data 行的 JSON；event 行冗余于 payload.type，以 payload 为准。
 */
export function parseSseFrame(frame: string): SseEvent | null {
  const dataLine = frame
    .split('\n')
    .find(line => line.startsWith('data:'))
  if (!dataLine)
    return null
  const json = dataLine.slice('data:'.length).trim()
  return JSON.parse(json) as SseEvent
}
