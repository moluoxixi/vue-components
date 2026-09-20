import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'tag',
  order: 270,
  title: 'Tag',
  category: 'Display',
  tag: 'el-tag',
  component: shared.ElementDisplayTag,
  props: { text: 'Tag' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
