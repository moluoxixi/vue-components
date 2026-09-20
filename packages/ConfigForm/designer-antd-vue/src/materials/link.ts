import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'link',
  order: 320,
  title: 'Link',
  category: 'Actions',
  tag: 'a-typography-link',
  component: shared.AntdDisplayLink,
  props: { text: 'Link' },
  semanticTriggers: ['activate'],
  setters: [shared.propSetter('text', 'Text', 'text')],
})
