/**
 * 从 LLM 回答（Markdown）中切分有序分段，并把 ```vue 代码块判定为能否转 demo 预览。
 *
 * 用途：前端 ChatView 把回答正文按「文字段 + vue 代码块」原位分段渲染——可渲染的 vue 块
 * 原地替换成 DemoPreview 实时预览，不可渲染的仅展示源码 + 原因；后端 query-handler 复用
 * extractVueBlocks 产出 example 事件的 blocks（兼容旧前端）。
 *
 * 可渲染判定：可渲染 demo 由 src/ui/preview/compile.ts 在浏览器内用 vue3-sfc-loader 编译挂载，
 * 其 moduleCache 注入了 `vue`、`element-plus` 与 `@moluoxixi/components`（含样式副作用）。示例若 import
 * 白名单外的依赖，loader 的 getFile 会抛「未预期的模块请求」导致编译失败、预览空白。
 * 因此做两道判定：
 * 1. 显式标识：fenced info 串带 `no-demo`（如 ```vue no-demo）→ AI 已声明依赖外部库，不转 demo。
 * 2. import 白名单二次校验：即便 AI 漏标 no-demo，只要 import 了白名单外模块，仍标记不可渲染，
 *    从源头杜绝编译失败（防御点在系统边界——解析 LLM 不可信输出，符合「边界校验」）。
 */

/** 运行时预览可解析的依赖白名单（与 src/ui/preview/compile.ts 的 moduleCache 对齐）。 */
export const PREVIEW_ALLOWED_MODULES: readonly string[] = [
  'vue',
  'element-plus',
  'element-plus/dist/index.css',
  '@moluoxixi/components',
  '@moluoxixi/components/styles',
]

/** 单个提取出的 vue 代码块。 */
export interface VueBlock {
  /** 代码块原始源码（不含 fence 行）。 */
  source: string
  /** 能否转 demo 预览块（false 时前端仅展示源码 + 复制 + 原因，不编译挂载）。 */
  renderable: boolean
  /** 不可渲染原因（renderable=false 时必有），供前端提示用户。 */
  reason?: string
}

/** 回答分段：纯文字段，或一个 vue 代码块。前端按序原位渲染。 */
export type AnswerSegment
  = | { kind: 'text', text: string }
    | ({ kind: 'vue' } & VueBlock)

/** fence 起始行：``` 或 ~~~（≥3 个），紧跟语言/ info 串。负向先行锁定 fence run 最大匹配。 */
const FENCE_RE = /^([`~]{3,})(?![`~])([^\n]*)$/

/** 从 SFC 源码中解析所有 import 的模块说明符（裸 import / from import / 动态 import 皆覆盖）。 */
function parseImportSpecifiers(source: string): string[] {
  const specs: string[] = []
  // 拆成三个无重叠量词的子模式，规避正则超线性回溯：
  //   from 子句（含 default / 具名 / 混合 import 的 from）、裸静态 import、动态 import()
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(source)) !== null) {
      if (m[1])
        specs.push(m[1])
    }
  }
  return specs
}

/**
 * 判断一个模块说明符是否在预览白名单内。
 * 白名单必须与 preview/compile.ts 的 moduleCache 精确对齐；子路径 import 运行时无法解析。
 */
function isAllowedSpecifier(spec: string): boolean {
  if (spec.startsWith('.') || spec.startsWith('/'))
    return false
  return PREVIEW_ALLOWED_MODULES.includes(spec)
}

/** info 串是否声明了 no-demo 标识（大小写不敏感，作为独立 token）。 */
function hasNoDemoFlag(info: string): boolean {
  return info
    .split(/[\s,]+/)
    .map(t => t.toLowerCase())
    .includes('no-demo')
}

/** info 串首 token 是否表明这是 vue 代码块。 */
function isVueInfo(info: string): boolean {
  const lang = info.trim().split(/[\s,]+/)[0]?.toLowerCase()
  return lang === 'vue'
}

/** 对单块做可渲染性判定：no-demo 标识优先，其次 import 白名单校验。 */
function judgeBlock(source: string, info: string): VueBlock {
  if (hasNoDemoFlag(info)) {
    return {
      source,
      renderable: false,
      reason: '该示例依赖预览环境外的库，已标记 no-demo，仅展示源码。',
    }
  }
  const disallowed = parseImportSpecifiers(source).filter(s => !isAllowedSpecifier(s))
  if (disallowed.length) {
    return {
      source,
      renderable: false,
      reason: `示例引入了预览环境无法解析的依赖（${disallowed.join('、')}），仅展示源码。预览仅支持 ${PREVIEW_ALLOWED_MODULES.join('、')}。`,
    }
  }
  return { source, renderable: true }
}

/**
 * 把 Markdown 文本切分为有序分段（文字段 + vue 代码块）。
 * 非 vue 的代码块（如 ```ts、```bash）并入文字段，保留围栏原文。
 * 未闭合的 fence 当作普通文字（流式未结束时代码块尚不完整，保持文字直到闭合）。
 * @param markdown LLM 完整或流式中的回答文本。
 * @returns 按出现顺序排列的分段，相邻文字自动合并、首尾空白文字段被丢弃。
 */
export function splitAnswerSegments(markdown: string): AnswerSegment[] {
  const lines = markdown.split('\n')
  const segments: AnswerSegment[] = []
  let textBuf: string[] = []

  const flushText = (): void => {
    if (!textBuf.length)
      return
    const text = textBuf.join('\n')
    if (text.trim().length)
      segments.push({ kind: 'text', text: text.replace(/^\n+|\n+$/g, '') })
    textBuf = []
  }

  let i = 0
  while (i < lines.length) {
    const open = FENCE_RE.exec(lines[i])
    if (!open) {
      textBuf.push(lines[i])
      i += 1
      continue
    }
    const fenceMarker = open[1]
    const info = open[2] ?? ''
    const fenceChar = fenceMarker[0]
    const bodyLines: string[] = []
    let j = i + 1
    let closed = false
    while (j < lines.length) {
      const close = FENCE_RE.exec(lines[j])
      if (close && close[1][0] === fenceChar && close[1].length >= fenceMarker.length && close[2].trim() === '') {
        closed = true
        break
      }
      bodyLines.push(lines[j])
      j += 1
    }
    if (!closed) {
      // 未闭合：整段（含起始 fence 行）当文字保留，继续向后扫描
      textBuf.push(lines[i])
      i += 1
      continue
    }
    if (isVueInfo(info)) {
      flushText()
      const block = judgeBlock(bodyLines.join('\n'), info)
      segments.push({ kind: 'vue', ...block })
    }
    else {
      // 非 vue 代码块：原样并入文字（保留围栏），交给前端 Markdown/文本渲染
      textBuf.push(lines[i], ...bodyLines, lines[j])
    }
    i = j + 1
  }
  flushText()
  return segments
}

/**
 * 提取 Markdown 文本中所有 vue 代码块并判定可渲染性（后端 example 事件用）。
 * @param markdown LLM 完整回答文本。
 * @returns 按出现顺序排列的 vue 块（含不可渲染块，前端据 renderable 区分处理）。
 */
export function extractVueBlocks(markdown: string): VueBlock[] {
  return splitAnswerSegments(markdown)
    .filter((s): s is { kind: 'vue' } & VueBlock => s.kind === 'vue')
    .map(({ kind: _kind, ...block }) => block)
}
