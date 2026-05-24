import type { SourceMap } from 'magic-string'
import type { ChildProcess } from 'node:child_process'
import { ConfigFormError } from '@moluoxixi/config-form'

/** Vite transform 阶段注入到 defineField(...) 调用里的源码位置。 */
export interface FieldSourceMeta {
  /** 稳定源码 id，用于匹配渲染后的 DOM 标记和 devtools 节点。 */
  readonly id: string
  /** 绝对路径或 Vite 标准化后的源码路径。 */
  readonly file: string
  /** 从 1 开始的源码行号。 */
  readonly line: number
  /** 从 1 开始的源码列号。 */
  readonly column: number
}

/** devtools 树节点类型。 */
export type FormDevtoolsNodeKind = 'component' | 'field' | 'render'

/** ConfigForm adapter 注册到浏览器 devtools bridge 的节点数据。 */
export interface FormDevtoolsNode {
  /** 节点稳定 id，由 form id 与节点路径或字段 key 共同限定。 */
  id: string
  /** 所属 ConfigForm 实例的稳定 id。 */
  formId: string
  /** 所属表单的可读标签，用于多表单导航。 */
  formLabel?: string
  /** 当前节点绑定字段值，还是只渲染组件结构。 */
  kind: FormDevtoolsNodeKind
  /** 当前父节点下的声明顺序。 */
  order?: number
  /** kind 为 field 时绑定的表单值 key。 */
  field?: string
  /** 可解析时记录组件名、原生标签名或组件 key。 */
  component?: string
  /** 嵌套 slot 树中的父级 devtools 节点 id。 */
  parentId?: string
  /** 可静态读取时记录渲染后的字段标签。 */
  label?: string
  /** 生成当前节点的 slot 名称。 */
  slotName?: string
  /** open-in-editor 使用的注入源码位置。 */
  source?: FieldSourceMeta
}

/** 用于度量单个节点渲染耗时的 Vue 生命周期阶段。 */
export type FormNodeRenderPhase = 'mount' | 'update'

/** adapter 发送的单节点耗时指标公共字段。 */
export interface FormNodeTimingMetric {
  /** 已注册的 devtools 节点 id。 */
  id: string
  /** 耗时，单位 ms。 */
  duration: number
  /** 指标时间戳，使用 performance.now()/Date.now() 的单位。 */
  timestamp: number
}

/** 通过 Vue vnode 生命周期 hook 采集的单节点渲染耗时。 */
export interface FormNodeRenderMetric extends FormNodeTimingMetric {
  /** 产生本次渲染指标的生命周期阶段。 */
  phase: FormNodeRenderPhase
}

/** adapter 同步 bridge 时采集的单节点同步耗时。 */
export type FormNodeSyncMetric = FormNodeTimingMetric

/** 虚拟 devtools client 注入到浏览器中的 bridge。 */
export interface FormDevtoolsBridge {
  /** 注册新节点及其最佳匹配 DOM 元素。 */
  registerField: (node: FormDevtoolsNode, element: HTMLElement | null) => void
  /** 更新已有节点及其最佳匹配 DOM 元素。 */
  updateField: (node: FormDevtoolsNode, element: HTMLElement | null) => void
  /** 记录节点真实渲染耗时。 */
  recordRender: (metric: FormNodeRenderMetric) => void
  /** 记录 devtools bridge 同步耗时。 */
  recordSync: (metric: FormNodeSyncMetric) => void
  /** 按 id 移除节点。 */
  unregisterField: (id: string) => void
}

/** 返回给 Vite 的 MagicString transform 结果。 */
export interface ConfigFormDevtoolsTransformResult {
  /** 转换后的源码。 */
  code: string
  /** transform 生成的高精度 source map。 */
  map: SourceMap
}

/** defineField 源码位置注入选项。 */
export interface SourceInjectionOptions {
  /** 待转换源码。 */
  code: string
  /** 当前文件的 Vite module id。 */
  id: string
  /** 开发模式下重写 ConfigForm import 的虚拟 adapter id。 */
  adapterModuleId?: string
  /** 应识别为 ConfigForm core import 的包名。 */
  packageNames?: string[]
}

/** 已解析完成的编辑器命令。 */
export interface EditorCommand {
  /** 可执行文件名或 shell 命令名。 */
  command: string
  /** 命令参数。 */
  args: string[]
  /** 是否通过 shell 启动命令。 */
  shell?: boolean
}

/** devtools 浏览器端发送给 Vite middleware 的请求载荷。 */
export interface OpenInEditorPayload {
  /** 要打开的源码文件路径。 */
  file: string
  /** 从 1 开始的源码行号。 */
  line: number
  /** 从 1 开始的源码列号。 */
  column: number
}

/** 基于源码位置构造编辑器命令的输入。 */
export interface EditorCommandInput extends OpenInEditorPayload {
  editor?: string | EditorCommand
}

/** 测试和编辑器启动逻辑共用的 spawn 抽象。 */
export type SpawnEditorProcess = (
  command: string,
  args: string[],
  options: { detached: boolean, shell?: boolean, stdio: 'ignore' },
) => ChildProcess

/** devtools middleware 启动源码文件的选项。 */
export interface OpenInEditorOptions {
  /** source-open 请求允许访问的项目根目录。 */
  root: string
  /** monorepo 或 linked package 源码允许访问的额外根目录。 */
  allowRoots?: string[]
  /** 编辑器预设、可执行文件名或完整命令覆盖；字符串会交给 launch-editor 解析。 */
  editor?: string | EditorCommand
  /** 测试可注入的 spawn 实现。 */
  spawn?: SpawnEditorProcess
}

/** 公开 Vite 插件选项。 */
export interface ConfigFormDevtoolsPluginOptions {
  /** 需要重写和检查的 ConfigForm 包名。 */
  packageNames?: string[]
  /** open-in-editor endpoint 允许访问的额外文件系统根目录。 */
  allowRoots?: string[]
  /** source-open 使用的编辑器预设、可执行文件名或命令覆盖；字符串会交给 launch-editor 解析。 */
  editor?: string | EditorCommand
}

/** transform 阶段失败时抛出的错误，供 Vite 直接展示。 */
export class ConfigFormDevtoolsPluginError extends ConfigFormError<Record<string, unknown>> {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super('CONFIG_FORM_DEVTOOLS_PLUGIN_ERROR', message, context)
    this.name = 'ConfigFormDevtoolsPluginError'
  }
}

/** open-in-editor middleware 使用的带 HTTP 状态码错误。 */
export class ConfigFormDevtoolsHttpError extends ConfigFormError<Record<string, unknown>> {
  readonly statusCode: number

  constructor(
    statusCode: number,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super('CONFIG_FORM_DEVTOOLS_HTTP_ERROR', message, { ...context, statusCode })
    this.name = 'ConfigFormDevtoolsHttpError'
    this.statusCode = statusCode
  }
}
