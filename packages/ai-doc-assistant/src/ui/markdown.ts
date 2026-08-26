import MarkdownIt from 'markdown-it'

function isAllowedLink(url: string): boolean {
  const value = url.trim()
  if (!value || value.startsWith('//'))
    return false
  if (value.startsWith('#') || value.startsWith('/') || value.startsWith('./') || value.startsWith('../'))
    return true

  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(value)?.[1]?.toLowerCase()
  if (!scheme)
    return true
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto'
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

markdown.validateLink = isAllowedLink

const defaultLinkOpen = markdown.renderer.rules.link_open
  ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const href = tokens[index].attrGet('href') ?? ''
  if (/^https?:/i.test(href)) {
    tokens[index].attrSet('target', '_blank')
    tokens[index].attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, index, options, env, self)
}

/** 仅渲染不可信 Markdown；原生 HTML 被转义，链接经过严格 scheme allowlist。 */
export function renderMarkdown(source: string): string {
  return markdown.render(source)
}
