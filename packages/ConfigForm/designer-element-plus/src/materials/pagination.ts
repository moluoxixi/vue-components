import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'pagination',
  locale: { title: '分页', category: '数据', setters: { total: '总条数', pageSize: '每页条数' } },
  order: 320,
  title: 'Pagination',
  category: 'Data',
  tag: 'el-pagination',
  component: shared.ElementDisplayPagination,
  props: { total: 0, pageSize: 10 },
  setters: [shared.propSetter('total', 'Total', 'number', undefined, { min: 0, step: 1 }), shared.propSetter('pageSize', 'Page size', 'number', undefined, { min: 1, step: 1 })],
})
