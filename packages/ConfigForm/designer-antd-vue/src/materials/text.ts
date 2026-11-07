import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'text',
  locale: { title: '文本', category: '展示', setters: { text: '文本' } },
  order: 260,
  title: 'Text',
  category: 'Display',
  tag: 'a-typography-text',
  component: shared.AntdDisplayText,
  props: { text: 'Text' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
