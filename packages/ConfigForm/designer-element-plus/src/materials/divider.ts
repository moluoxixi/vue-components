import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'divider',
  locale: { title: '分割线', category: '展示', setters: { text: '文本' } },
  order: 240,
  title: 'Divider',
  category: 'Display',
  tag: 'el-divider',
  component: shared.ElementDisplayDivider,
  props: { text: '' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
