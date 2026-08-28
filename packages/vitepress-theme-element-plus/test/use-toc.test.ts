import type { PageData } from 'vitepress'
import { describe, expect, it } from 'vitest'
import {
  resolveDocumentHeaders,
  resolveHeaders,
} from '../src/upstream/vitepress/composables/use-toc'

describe('resolveHeaders', () => {
  it('preserves every heading from nested VitePress page data', () => {
    const headers = [
      {
        level: 2,
        title: 'Level 2',
        slug: 'level-2',
        link: '#level-2',
        children: [
          {
            level: 3,
            title: 'Level 3',
            slug: 'level-3',
            link: '#level-3',
            children: [
              {
                level: 4,
                title: 'Level 4',
                slug: 'level-4',
                link: '#level-4',
              },
            ],
          },
        ],
      },
    ] as PageData['headers']

    expect(resolveHeaders(headers)).toEqual([
      {
        text: 'Level 2',
        link: '#level-2',
        children: [
          {
            text: 'Level 3',
            link: '#level-3',
            children: [
              { text: 'Level 4', link: '#level-4', children: undefined },
            ],
          },
        ],
      },
    ])
  })

  it('builds a nested tree from runtime document headings', () => {
    const container = document.createElement('article')
    container.innerHTML = `
      <h2 id="level-2">
        Level 2
        <a class="header-anchor" href="#level-2">&#8203;</a>
        <span class="VPBadge">beta</span>
      </h2>
      <h3 id="level-3">Level <code>3</code><sup class="footnote-ref">1</sup></h3>
      <h4 id="level-4">Level 4<span><span class="ignore-header">hidden</span></span></h4>
      <h2 id="second-level-2">Second Level 2</h2>
    `

    expect(resolveDocumentHeaders(container)).toEqual([
      {
        text: 'Level 2',
        link: '#level-2',
        children: [
          {
            text: 'Level 3',
            link: '#level-3',
            children: [
              { text: 'Level 4', link: '#level-4' },
            ],
          },
        ],
      },
      { text: 'Second Level 2', link: '#second-level-2' },
    ])
  })
})
