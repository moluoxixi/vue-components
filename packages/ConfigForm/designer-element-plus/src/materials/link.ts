import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'link',
  order: 260,
  title: 'Link',
  category: 'Actions',
  tag: 'el-link',
  component: shared.ElementDisplayLink,
  props: { text: 'Link' },
  semanticTriggers: ['activate'],
  setters: [shared.propSetter('text', 'Text', 'text')],
})
