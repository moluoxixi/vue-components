import type { AiRuntimeStatus, EmbeddingProviderId } from '@moluoxixi/ai-provider/shared'
import type { UIMessage } from 'ai'

/** 前后端共享协议层；仅包含 browser-safe 类型与常量。 */

/** 检索无命中阈值：top1 归一化 score 低于此值视为无依据，触发兜底（不输出示例）。 */
export const NO_MATCH_SCORE_THRESHOLD = 0.3

/** BFF 统一 API 前缀。 */
export const API_PREFIX = '/__ai-doc/api'

/** 对话历史上限：客户端裁剪与服务端边界校验共用，避免两端漂移。 */
export const MAX_HISTORY_MESSAGES = 20
export const MAX_HISTORY_CHARACTERS = 20_000

/** 索引状态机的四个状态。 */
export type IndexState = 'not_built' | 'building' | 'ready' | 'stale'

/** 统一错误码。 */
export type ApiErrorCode
  = | 'INVALID_REQUEST'
    | 'NOT_FOUND'
    | 'INDEX_NOT_READY'
    | 'CONFLICT'
    | 'UPSTREAM_ERROR'
    | 'INTERNAL_ERROR'

/** 错误码 → 默认 HTTP 状态映射。 */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  INDEX_NOT_READY: 409,
  CONFLICT: 409,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
}

/** 知识库来源：internal 为当前项目抽取，external 为用户导入。 */
export type KnowledgeSourceWire = 'internal' | 'external'

/** 统一错误响应体。 */
export interface ApiErrorBody {
  error: ApiErrorCode
  message: string
}

/** 检索命中的来源引用（回传给前端做可追溯展示）。 */
export interface SourceRef {
  component: string
  packageName: string
  docPath: string
  score: number
  source?: KnowledgeSourceWire
  /** 同名组件跨来源时用于精确打开知识库详情。 */
  knowledgeKey?: string
}

export interface AiDocDataParts {
  sources: SourceRef[]
  example: { blocks: ExampleBlock[] }
}

export type AiDocUIMessage = UIMessage<never, AiDocDataParts>

/** Standard AI SDK chat request body. */
export interface QueryRequest {
  messages: AiDocUIMessage[]
  topK?: number
}

/** GET /index/status 响应体。 */
export interface IndexStatusResponse {
  state: IndexState
  builtAt: string | null
  stale: boolean
  componentCount: number
  internalCount?: number
  externalCount?: number
  embeddingIdentity: {
    provider: EmbeddingProviderId
    model: string
    endpointFingerprint: string
    dimension: number
  } | null
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
  source?: KnowledgeSourceWire
  knowledgeKey?: string
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
  /** 该事件载荷类型引用的项目内自定义类型名（关联 typeDefs）。 */
  typeRefs: string[]
}

/** 单个 slot 的 wire 形态。 */
export interface SlotWire {
  name: string
  /** 插槽作用域类型。 */
  scopeType: string
  description: string
  /** 该插槽作用域类型引用的项目内自定义类型名（关联 typeDefs）。 */
  typeRefs: string[]
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
  /** 该暴露成员类型引用的项目内自定义类型名（关联 typeDefs）。 */
  typeRefs: string[]
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
  source?: KnowledgeSourceWire
  knowledgeKey?: string
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

/** AI Doc 知识库导入导出的协议标识。 */
export const KNOWLEDGE_IMPORT_PROTOCOL = 'ai-doc-knowledge'

/** AI Doc 知识库导入导出的协议版本。 */
export const KNOWLEDGE_IMPORT_PROTOCOL_VERSION = 1

/** 协议化导入 JSON：显式携带协议版本，detail 仍沿用普通组件详情契约。 */
export interface KnowledgeImportEnvelope {
  protocol: typeof KNOWLEDGE_IMPORT_PROTOCOL
  protocolVersion: typeof KNOWLEDGE_IMPORT_PROTOCOL_VERSION
  kind: 'component-detail'
  detail: ComponentDetailResponse
}

/** 导入 JSON：兼容协议化 envelope 与普通组件详情 JSON；服务端导入时统一标记为 external。 */
export type KnowledgeImportPayload = KnowledgeImportEnvelope | ComponentDetailResponse

/** POST /knowledge/import 响应。 */
export interface KnowledgeImportResult {
  status: 'imported' | 'overwritten' | 'conflict'
  key: string
  source: KnowledgeSourceWire
  name: string
  packageName: string
  conflictsWithInternal: boolean
}

/** POST /knowledge/import 请求体。 */
export interface KnowledgeImportRequest {
  payload: KnowledgeImportPayload
  overwrite?: boolean
}

/** 检索模式：content=结构化关键词 topK（默认）；vector=向量语义检索（可选增强）。 */
export type RetrievalModeWire = 'content' | 'vector'

/**
 * GET /health 响应体——provider 仅暴露配置态，绝不返回密钥。
 * mode 暴露当前检索模式；vector 模式使用独立配置的远程 embedding Provider，
 * 状态只返回 provider/model 与配置态，不返回密钥或密钥环境变量名。
 */
export interface HealthResponse {
  ok: boolean
  providers: AiRuntimeStatus
  /** 当前检索模式。 */
  mode: RetrievalModeWire
  index: IndexState
}

/** UI Message Stream 的 data-example 数据块；不可渲染代码仍可安全展示与复制。 */
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
