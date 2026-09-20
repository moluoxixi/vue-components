import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'tag',
  order: 330,
  title: 'Tag',
  category: 'Display',
  tag: 'a-tag',
  component: shared.AntdDisplayTag,
  props: { text: 'Tag' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
