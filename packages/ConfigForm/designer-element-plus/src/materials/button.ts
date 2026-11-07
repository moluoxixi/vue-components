import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'button',
  locale: { title: '按钮', category: '操作', setters: { text: '文本', type: '类型' } },
  order: 250,
  title: 'Button',
  category: 'Actions',
  tag: 'el-button',
  component: shared.ElementDisplayButton,
  props: { text: 'Button', type: 'primary' },
  semanticTriggers: ['activate'],
  setters: [shared.propSetter('text', 'Text', 'text'), shared.propSetter('type', 'Type', 'text')],
})
