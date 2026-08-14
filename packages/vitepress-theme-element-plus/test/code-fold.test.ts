// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { computeFoldRegions, getIndent } from '../src/content/demo/code-fold'
import ElementPlusDocsDemoSource from '../src/content/demo/ElementPlusDocsDemoSource.vue'

describe('element Plus Demo code folding', () => {
  it('copies the upstream indentation folding rules, including tab stops', () => {
    expect(getIndent('\t  value')).toBe(4)
    expect(computeFoldRegions([
      '<template>',
      '  <section>',
      '    <p>content</p>',
      '  </section>',
      '</template>',
    ])).toEqual([
      { start: 0, end: 3 },
      { start: 1, end: 2 },
    ])
  })

  it('folds and unfolds highlighted source regions accessibly', async () => {
    const wrapper = mount(ElementPlusDocsDemoSource, {
      props: {
        foldCodeRegion: 'Fold code region',
        foldedLine: '{lines} line folded',
        foldedLines: '{lines} lines folded',
        source: '<div class="language-vue"><pre><code><span class="line">&lt;template&gt;</span>\n<span class="line">  &lt;section&gt;</span>\n<span class="line">    content</span>\n<span class="line">  &lt;/section&gt;</span>\n<span class="line">&lt;/template&gt;</span></code></pre></div>',
        unfoldCodeRegion: 'Unfold code region',
      },
    })

    const lines = wrapper.findAll('.code-line')
    expect(lines).toHaveLength(5)
    const foldButton = wrapper.findAll('.code-fold-btn')[0]
    expect(foldButton).toBeDefined()
    expect(foldButton!.attributes('aria-expanded')).toBe('true')

    await foldButton!.trigger('click')
    expect(foldButton!.attributes('aria-expanded')).toBe('false')
    expect(foldButton!.attributes('aria-label')).toBe('Unfold code region')
    expect(lines[1]!.attributes('style')).toContain('display: none')

    const placeholder = wrapper.get('.code-fold-placeholder')
    expect(placeholder.attributes('title')).toBe('3 lines folded')
    await placeholder.trigger('click')
    expect(foldButton!.attributes('aria-expanded')).toBe('true')
    expect(lines[1]!.attributes('style') ?? '').not.toContain('display: none')
  })
})
