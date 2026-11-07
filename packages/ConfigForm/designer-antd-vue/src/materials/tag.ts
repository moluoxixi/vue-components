import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'tag',
  locale: { title: '标签', category: '展示', setters: { text: '文本' } },
  order: 330,
  title: 'Tag',
  category: 'Display',
  tag: 'a-tag',
  component: shared.AntdDisplayTag,
  props: { text: 'Tag' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
