import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'alert',
  locale: { title: '提示', category: '展示', setters: { title: '标题', description: '说明', type: '类型', showIcon: '显示图标' } },
  order: 280,
  title: 'Alert',
  category: 'Display',
  tag: 'el-alert',
  component: shared.ElementDisplayAlert,
  props: { title: 'Alert', description: '', type: 'info', showIcon: true },
  setters: [shared.propSetter('title', 'Title', 'text'), shared.propSetter('description', 'Description', 'textarea'), shared.propSetter('type', 'Type', 'text'), shared.propSetter('showIcon', 'Show icon', 'boolean')],
})
