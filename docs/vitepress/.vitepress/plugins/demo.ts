import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { Buffer } from 'node:buffer'
import container from 'markdown-it-container'

function encodeBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

export function demoPlugin(md: MarkdownIt): void {
  md.use(container, 'demo', {
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

        const safeTitle = title.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        const encodedCode = encodeBase64(code)
        const encodedHl = encodeBase64(highlighted)
        return `<Demo code="${encodedCode}" highlighted="${encodedHl}" title="${safeTitle}">\n`
      }
      else {
        return `</Demo>\n`
      }
    },
  })
}
