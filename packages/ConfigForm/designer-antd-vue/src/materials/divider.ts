import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'divider',
  locale: { title: '分割线', category: '展示', setters: { text: '文本' } },
  order: 300,
  title: 'Divider',
  category: 'Display',
  tag: 'a-divider',
  component: shared.AntdDisplayDivider,
  props: { text: '' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
