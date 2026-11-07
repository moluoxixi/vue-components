import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'table',
  locale: { title: '表格', category: '数据', setters: { } },
  order: 290,
  title: 'Table',
  category: 'Data',
  tag: 'el-table',
  component: shared.ElementDatasetTable,
  props: { rows: [] },
  semanticTriggers: ['rowActivate'],
  nativeSource: true,
  sourceRender: 'dataset-table',
  datasetBindings: [{ key: 'rows', projectionKinds: ['table'] }],
})
