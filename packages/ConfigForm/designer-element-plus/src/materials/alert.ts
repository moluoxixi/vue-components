import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'alert',
  order: 280,
  title: 'Alert',
  category: 'Display',
  tag: 'el-alert',
  component: shared.ElementDisplayAlert,
  props: { title: 'Alert', description: '', type: 'info', showIcon: true },
  setters: [shared.propSetter('title', 'Title', 'text'), shared.propSetter('description', 'Description', 'textarea'), shared.propSetter('type', 'Type', 'text'), shared.propSetter('showIcon', 'Show icon', 'boolean')],
})
