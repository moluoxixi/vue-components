import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'button',
  order: 310,
  title: 'Button',
  category: 'Actions',
  tag: 'a-button',
  component: shared.AntdDisplayButton,
  props: { text: 'Button', type: 'primary' },
  semanticTriggers: ['activate'],
  setters: [shared.propSetter('text', 'Text', 'text'), shared.propSetter('type', 'Type', 'text')],
})
