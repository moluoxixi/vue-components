import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import container from 'markdown-it-container'

const compatibleContainer = container as unknown as Parameters<MarkdownIt['use']>[0]

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

export function createElementPlusDocsDemoId(title: string, code: string): string {
  return `demo-${createHash('sha256').update(title).update('\0').update(code).digest('hex').slice(0, 16)}`
}

export function elementPlusDocsDemoPlugin(md: MarkdownIt): void {
  md.use(compatibleContainer, 'demo', {
    validate(params: string) {
      return /^demo\b/.test(params.trim())
    },
    render(tokens: Token[], index: number) {
      const token = tokens[index]

      if (token.nesting !== 1)
        return '</Demo>\n'

      const title = token.info.trim().replace(/^demo\s*/, '')
      let code = ''
      let highlighted = ''
      for (let cursor = index + 1; cursor < tokens.length; cursor++) {
        const candidate = tokens[cursor]
        if (candidate.type === 'container_demo_close')
          break
        if (candidate.type !== 'fence')
          continue

        code = candidate.content
        const language = candidate.info.trim() || 'vue'
        highlighted = md.options.highlight?.(code, language, '')
          ?? `<pre><code>${md.utils.escapeHtml(code)}</code></pre>`
        candidate.type = 'html_block'
        candidate.content = ''
        break
      }

      const demoId = createElementPlusDocsDemoId(title, code)
      return `<Demo demo-id="${demoId}" code="${encodeBase64(code)}" highlighted="${encodeBase64(highlighted)}" title="${md.utils.escapeHtml(title)}">\n`
    },
  })
}
