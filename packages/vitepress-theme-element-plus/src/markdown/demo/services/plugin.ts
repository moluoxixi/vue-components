import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type { ElementPlusDocsExternalProjectSource } from '../../../content/playground/external/vue-project'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import container from 'markdown-it-container'
import { formatSfcTypeScript, sfcTs2js } from '../../utils'

const compatibleContainer = container as unknown as Parameters<MarkdownIt['use']>[0]

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

export interface ElementPlusDocsDemoSource {
  code: string
  demoId: string
  endLine: number
  startLine: number
  title: string
}

export interface ElementPlusDocsDemoSourceHrefContext {
  code: string
  demoId: string
  endLine: number
  environment: unknown
  startLine: number
  title: string
}

export interface ElementPlusDocsDemoExternalProjectContext extends ElementPlusDocsDemoSourceHrefContext {
  sourceLanguage: 'JS' | 'TS'
}

interface ElementPlusDocsDemoPluginOptions {
  resolveExternalProjectSource?: (
    context: ElementPlusDocsDemoExternalProjectContext,
  ) => ElementPlusDocsExternalProjectSource | undefined
  resolveSourceHref?: (context: ElementPlusDocsDemoSourceHrefContext) => string | undefined
}

export function createElementPlusDocsDemoId(title: string, code: string): string {
  return `demo-${createHash('sha256').update(title).update('\0').update(code).digest('hex').slice(0, 16)}`
}

export function collectElementPlusDocsDemos(md: MarkdownIt, source: string): ElementPlusDocsDemoSource[] {
  const tokens = md.parse(source, {})
  const demos: ElementPlusDocsDemoSource[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const containerToken = tokens[index]
    if (containerToken.type !== 'container_demo_open' || containerToken.nesting !== 1)
      continue

    const title = containerToken.info.trim().replace(/^demo\s*/, '')
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const candidate = tokens[cursor]
      if (candidate.type === 'container_demo_close')
        break
      if (candidate.type !== 'fence')
        continue

      const code = candidate.content
      const startLine = candidate.map ? candidate.map[0] + 1 : 0
      const endLine = candidate.map ? candidate.map[1] : 0
      demos.push({
        code,
        demoId: createElementPlusDocsDemoId(title, code),
        endLine,
        startLine,
        title,
      })
      break
    }
  }

  return demos
}

export function elementPlusDocsDemoPlugin(
  md: MarkdownIt,
  options: ElementPlusDocsDemoPluginOptions = {},
): void {
  md.use(compatibleContainer, 'demo', {
    validate(params: string) {
      return /^demo\b/.test(params.trim())
    },
    render(tokens: Token[], index: number, _options: unknown, environment: unknown) {
      const token = tokens[index]

      if (token.nesting !== 1)
        return '</Demo>\n'

      const title = token.info.trim().replace(/^demo\s*/, '')
      let code = ''
      let language = 'vue'
      let sourceStartLine = 0
      let sourceEndLine = 0
      for (let cursor = index + 1; cursor < tokens.length; cursor++) {
        const candidate = tokens[cursor]
        if (candidate.type === 'container_demo_close')
          break
        if (candidate.type !== 'fence')
          continue

        code = candidate.content
        sourceStartLine = candidate.map ? candidate.map[0] + 1 : 0
        sourceEndLine = candidate.map ? candidate.map[1] : 0
        language = candidate.info.trim() || 'vue'
        candidate.type = 'html_block'
        candidate.content = ''
        break
      }

      const demoId = createElementPlusDocsDemoId(title, code)
      code = formatSfcTypeScript(code)
      const highlighted = md.options.highlight?.(code, language, '')
        ?? `<pre><code>${md.utils.escapeHtml(code)}</code></pre>`
      const sourceContext = {
        code,
        demoId,
        endLine: sourceEndLine,
        environment,
        startLine: sourceStartLine,
        title,
      }
      const sourceHref = options.resolveSourceHref?.(sourceContext)
      const sourceAttribute = sourceHref
        ? ` source-href="${md.utils.escapeHtml(sourceHref)}"`
        : ''
      const jsCode = sfcTs2js(code)
      const externalProjectSource = options.resolveExternalProjectSource?.({
        ...sourceContext,
        sourceLanguage: 'TS',
      })
      const externalJavaScriptProjectSource = options.resolveExternalProjectSource?.({
        ...sourceContext,
        code: jsCode,
        sourceLanguage: 'JS',
      })
      const externalProjectAttribute = externalProjectSource
        ? ` external-project-code="${encodeBase64(JSON.stringify(externalProjectSource))}"`
        : ''
      const externalJavaScriptProjectAttribute = externalJavaScriptProjectSource
        ? ` external-project-js-code="${encodeBase64(JSON.stringify(externalJavaScriptProjectSource))}"`
        : ''
      const jsHighlighted = md.options.highlight?.(jsCode, 'vue', '')
        ?? `<pre><code>${md.utils.escapeHtml(jsCode)}</code></pre>`
      return `<Demo demo-id="${demoId}" code="${encodeBase64(code)}" highlighted="${encodeBase64(highlighted)}" js-code="${encodeBase64(jsCode)}" js-highlighted="${encodeBase64(jsHighlighted)}"${externalProjectAttribute}${externalJavaScriptProjectAttribute}${sourceAttribute} title="${md.utils.escapeHtml(title)}">\n`
    },
  })
}
