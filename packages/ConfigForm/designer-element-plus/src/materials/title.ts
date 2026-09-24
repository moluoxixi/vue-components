import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'title',
  order: 210,
  title: 'Title',
  category: 'Display',
  tag: 'h2',
  component: shared.ElementDisplayTitle,
  nativeSource: true,
  props: { text: 'Title', level: 2 },
  setters: [shared.propSetter('text', 'Text', 'text'), shared.propSetter('level', 'Level', 'number', undefined, { min: 1, max: 6, step: 1 })],
})
