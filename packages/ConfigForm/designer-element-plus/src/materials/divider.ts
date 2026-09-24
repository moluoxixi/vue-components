import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'divider',
  order: 240,
  title: 'Divider',
  category: 'Display',
  tag: 'el-divider',
  component: shared.ElementDisplayDivider,
  props: { text: '' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
