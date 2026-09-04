import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownContent from '../src/ui/App/components/ChatView/components/MarkdownContent.vue'
import { renderMarkdown } from '../src/ui/markdown'

describe('markdown renderer', () => {
  it('渲染常用文档结构与非 Vue 代码块', () => {
    const wrapper = mount(MarkdownContent, {
      props: { source: '# 标题\n\n- 列表\n\n> 引用\n\n```ts\nconst ok = true\n```' },
    })

    expect(wrapper.find('h1').text()).toBe('标题')
    expect(wrapper.find('li').text()).toBe('列表')
    expect(wrapper.find('blockquote').text()).toBe('引用')
    expect(wrapper.find('pre code.language-ts').text()).toContain('const ok = true')
  })

  it('转义原生 HTML 并拒绝危险链接', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">\n\n[危险](javascript:alert(1))')

    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript:')
  })

  it.each([
    'JaVaScRiPt:alert(1)',
    'javascript&#x3A;alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example/path',
  ])('拒绝危险或协议相对 URL：%s', (url) => {
    const html = renderMarkdown(`[危险](${url})`)

    expect(html).not.toMatch(/<a\s[^>]*href=/i)
  })

  it('为外链增加安全属性并保留相对链接', () => {
    const wrapper = mount(MarkdownContent, {
      props: { source: '[外链](https://example.com/docs) [内部](./guide)' },
    })
    const links = wrapper.findAll('a')

    expect(links[0].attributes()).toMatchObject({
      href: 'https://example.com/docs',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(links[1].attributes('href')).toBe('./guide')
    expect(links[1].attributes('target')).toBeUndefined()
  })

  it('流式未闭合 fence 仍可安全渲染', () => {
    expect(() => renderMarkdown('回答中\n```ts\nconst partial =')).not.toThrow()
  })
})
