import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'list',
  locale: { title: '列表', category: '数据', setters: { } },
  order: 360,
  title: 'List',
  category: 'Data',
  tag: 'div',
  component: shared.AntdDatasetList,
  nativeSource: true,
  props: { items: [] },
  semanticTriggers: ['itemActivate'],
  sourceRender: 'dataset-list',
  datasetBindings: [{ key: 'items', projectionKinds: ['list'] }],
})
