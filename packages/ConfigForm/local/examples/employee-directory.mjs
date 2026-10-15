import { createStudioNode, createStudioProject } from '@moluoxixi/config-form-studio'

/** A portable acceptance project: static data, filtering, overlays and validation. */
export function createEmployeeDirectory(preset = 'element-plus') {
  const prefix = preset === 'element-plus' ? 'element' : 'antd'
  const project = createStudioProject({ id: `employee-${preset}`, name: '员工目录', preset })
  const home = project.surfacesById.home
  home.name = '员工目录'
  home.graph.form = { columns: 24, fieldSpan: 24, density: 'compact', labelPosition: 'top', responsive: { mobile: { columns: 1, fieldSpan: 1 } } }
  function insert(surface, component, id, options = {}, span = 24) {
    const subgraph = createStudioNode({ preset, component: `${prefix}.${component}`, id, ...options })
    surface.graph.root.push({ nodeId: id, placement: { span } })
    Object.assign(surface.graph.nodesById, subgraph.nodesById)
    return surface.graph.nodesById[id]
  }
  insert(home, 'title', 'title', { props: { text: '员工目录', level: 2 } })
  insert(home, 'switch', 'active-only', { field: 'activeOnly', label: '仅显示在职员工' })
  const tableBinding = { datasetId: 'employees', projection: { kind: 'table', rowKeyPath: ['id'], columns: [{ key: '姓名', valuePath: ['name'] }, { key: '部门', valuePath: ['department'] }, { key: '状态', valuePath: ['status'] }] } }
  insert(home, 'table', 'all-employees').datasetBindings = { rows: tableBinding }
  insert(home, 'table', 'active-employees').datasetBindings = { rows: { ...tableBinding, query: { filter: { version: 1, ast: { kind: 'reference', scope: 'item', path: ['active'] } } } } }
  const active = { version: 1, ast: { kind: 'reference', scope: 'values', path: ['activeOnly'] } }
  home.interactions.push(
    { kind: 'stateProjection', id: 'show-active', target: { kind: 'state', nodeId: 'active-employees', key: 'visible' }, value: active },
    { kind: 'stateProjection', id: 'show-all', target: { kind: 'state', nodeId: 'all-employees', key: 'visible' }, value: { version: 1, ast: { kind: 'unary', operator: '!', operand: active.ast } } },
  )
  for (const nodeId of ['all-employees', 'active-employees']) {
    home.interactions.push({ kind: 'primaryUiAction', id: `edit-${nodeId}`, nodeId, trigger: 'rowActivate', action: { kind: 'open', targetSurfaceId: 'edit-employee', parameters: [] } })
  }
  const template = createStudioProject({ id: 'dialog', name: '编辑员工', preset, templateId: `${prefix}-dialog` }).surfacesById['template-dialog']
  const dialog = { ...template, id: 'edit-employee', name: '编辑员工', presentation: { ...template.presentation, title: '编辑员工' } }
  const name = insert(dialog, 'input', 'employee-name', { field: 'employeeName', label: '姓名' })
  name.defaultValue = ''
  name.required = true
  name.requiredMessage = '请输入员工姓名'
  name.validation = { version: 2, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 2, message: '姓名至少两个字符' }] }
  insert(dialog, 'button', 'save-employee', { props: { text: '完成' } })
  dialog.interactions.push({ kind: 'primaryUiAction', id: 'save', nodeId: 'save-employee', trigger: 'activate', validate: { scope: 'fields', fieldIds: ['employee-name'] }, action: { kind: 'closeCurrent' } })
  project.surfaceOrder.push(dialog.id)
  project.surfacesById[dialog.id] = dialog
  project.datasetOrder.push('employees')
  project.datasetsById.employees = { id: 'employees', name: '员工', rows: [
    { id: 'E001', name: '林晓', department: '产品', status: '在职', active: true },
    { id: 'E002', name: '陈宇', department: '研发', status: '在职', active: true },
    { id: 'E003', name: '王宁', department: '设计', status: '离职', active: false },
  ], defaultProjection: tableBinding.projection }
  insert(home, 'text', 'hint', { props: { text: '点击员工行打开编辑表单。此项目使用本地演示数据。' } })
  insert(home, 'button', 'new-employee', { props: { text: '新建员工' } })
  home.interactions.push({ kind: 'primaryUiAction', id: 'new-employee', nodeId: 'new-employee', trigger: 'activate', action: { kind: 'open', targetSurfaceId: dialog.id, parameters: [] } })
  // This is a form interaction example; persistence of business records belongs to the exported app.
  return project
}
