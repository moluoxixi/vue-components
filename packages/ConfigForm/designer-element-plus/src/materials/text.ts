import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'text',
  locale: { title: '文本', category: '展示', setters: { text: '文本' } },
  order: 200,
  title: 'Text',
  category: 'Display',
  tag: 'el-text',
  component: shared.ElementDisplayText,
  props: { text: 'Text' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
