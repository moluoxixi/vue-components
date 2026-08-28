import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import VPTableOfContentLinks from '../src/upstream/vitepress/components/doc-content/vp-table-of-content-links.vue'

const AnchorStub = defineComponent({
  setup(_, { slots }) {
    return () => h('nav', slots.default?.())
  },
})

const AnchorLinkStub = defineComponent({
  props: {
    href: String,
    title: String,
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'anchor-item' }, [
      h('a', { href: props.href, title: props.title }, slots.default?.()),
      slots['sub-link']
        ? h('div', { class: 'anchor-list' }, slots['sub-link']())
        : undefined,
    ])
  },
})

describe('vp-table-of-content-links', () => {
  it('renders nested heading links recursively', () => {
    const wrapper = mount(VPTableOfContentLinks, {
      global: {
        stubs: {
          ElAnchor: AnchorStub,
          ElAnchorLink: AnchorLinkStub,
        },
      },
      props: {
        headers: [{
          link: '#level-2',
          text: 'Level 2',
          children: [{
            link: '#level-3',
            text: 'Level 3',
            children: [{ link: '#level-4', text: 'Level 4' }],
          }],
        }],
      },
    })

    const links = wrapper.findAll('a')
    expect(links.map(link => link.attributes('href'))).toEqual([
      '#level-2',
      '#level-3',
      '#level-4',
    ])
    expect(links.map((link) => {
      let depth = 0
      let item = link.element.closest('.anchor-item')
      while (item) {
        depth += 1
        item = item.parentElement?.closest('.anchor-item') ?? null
      }
      return depth
    })).toEqual([1, 2, 3])
  })
})
