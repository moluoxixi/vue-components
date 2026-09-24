import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'button',
  order: 250,
  title: 'Button',
  category: 'Actions',
  tag: 'el-button',
  component: shared.ElementDisplayButton,
  props: { text: 'Button', type: 'primary' },
  semanticTriggers: ['activate'],
  setters: [shared.propSetter('text', 'Text', 'text'), shared.propSetter('type', 'Type', 'text')],
})
