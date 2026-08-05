import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import container from 'markdown-it-container'

// markdown-it-container still publishes MarkdownIt 13 types while VitePress uses 14.
// Keep the compatibility cast at the plugin boundary; its runtime API is unchanged.
const compatibleContainer = container as unknown as Parameters<MarkdownIt['use']>[0]

function encodeBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

export function createDemoId(title: string, code: string): string {
  return `demo-${createHash('sha256').update(title).update('\0').update(code).digest('hex').slice(0, 16)}`
}

export function demoPlugin(md: MarkdownIt): void {
  md.use(compatibleContainer, 'demo', {
    validate(params: string) {
      return /^demo\b/.test(params.trim())
    },
    render(tokens: Token[], idx: number) {
      const token = tokens[idx]

      if (token.nesting === 1) {
        const title = token.info.trim().replace(/^demo\s*/, '')

        let code = ''
        let highlighted = ''
        for (let i = idx + 1; i < tokens.length; i++) {
          const t = tokens[i]
          if (t.type === 'container_demo_close')
            break
          if (t.type === 'fence') {
            code = t.content
            const lang = t.info.trim() || 'vue'
            highlighted = md.options.highlight?.(code, lang, '') ?? `<pre><code>${md.utils.escapeHtml(code)}</code></pre>`
            // Mark fence as consumed to prevent double-render
            t.type = 'html_block'
            t.content = ''
            break
          }
        }

        const safeTitle = md.utils.escapeHtml(title)
        const encodedCode = encodeBase64(code)
        const encodedHl = encodeBase64(highlighted)
        const demoId = createDemoId(title, code)
        return `<Demo demo-id="${demoId}" code="${encodedCode}" highlighted="${encodedHl}" title="${safeTitle}">\n`
      }
      else {
        return `</Demo>\n`
      }
    },
  })
}
