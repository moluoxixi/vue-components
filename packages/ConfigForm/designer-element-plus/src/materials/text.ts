import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'text',
  order: 200,
  title: 'Text',
  category: 'Display',
  tag: 'el-text',
  component: shared.ElementDisplayText,
  props: { text: 'Text' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
