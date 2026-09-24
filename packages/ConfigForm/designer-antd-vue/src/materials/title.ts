import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'title',
  order: 270,
  title: 'Title',
  category: 'Display',
  tag: 'a-typography-title',
  component: shared.AntdDisplayTitle,
  props: { text: 'Title', level: 2 },
  setters: [shared.propSetter('text', 'Text', 'text'), shared.propSetter('level', 'Level', 'number', undefined, { min: 1, max: 5, step: 1 })],
})
