import type { PageData } from 'vitepress'
import { describe, expect, it } from 'vitest'
import { resolveHeaders } from '../src/upstream/vitepress/composables/use-toc'

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
          { text: 'Level 3', link: '#level-3', children: undefined },
          { text: 'Level 4', link: '#level-4', children: undefined },
        ],
      },
    ])
  })
})
