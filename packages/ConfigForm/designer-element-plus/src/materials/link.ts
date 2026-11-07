import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'link',
  locale: { title: '链接', category: '操作', setters: { text: '文本' } },
  order: 260,
  title: 'Link',
  category: 'Actions',
  tag: 'el-link',
  component: shared.ElementDisplayLink,
  props: { text: 'Link' },
  semanticTriggers: ['activate'],
  setters: [shared.propSetter('text', 'Text', 'text')],
})
