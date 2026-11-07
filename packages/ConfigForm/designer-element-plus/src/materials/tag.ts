import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'tag',
  locale: { title: '标签', category: '展示', setters: { text: '文本' } },
  order: 270,
  title: 'Tag',
  category: 'Display',
  tag: 'el-tag',
  component: shared.ElementDisplayTag,
  props: { text: 'Tag' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
