import type {
  DesignerLocaleOptions,
  DesignerRegistry,
  LowCodeComponentRegistry,
} from '@moluoxixi/config-form-designer'
import type { WorkspaceApplication } from './project'
import { createLowCodeComponentRegistry } from '@moluoxixi/config-form-designer'

export type WorkbenchAdapterId = WorkspaceApplication['manifest']['adapter']

export interface WorkbenchAdapter {
  designerRegistry: DesignerRegistry
  locale: DesignerLocaleOptions
  lowCodeRegistry: LowCodeComponentRegistry
}

const adapterPromises = new Map<WorkbenchAdapterId, Promise<WorkbenchAdapter>>()

async function createWorkbenchAdapter(id: WorkbenchAdapterId): Promise<WorkbenchAdapter> {
  if (id === 'antd-vue') {
    const [adapter] = await Promise.all([
      import('@moluoxixi/config-form-designer-antd-vue'),
      import('ant-design-vue/dist/reset.css'),
      import('@moluoxixi/config-form-designer-antd-vue/styles'),
      import('@moluoxixi/config-form-antd-vue/styles'),
    ])
    const designerRegistry = adapter.createAntdVueDesignerRegistry()
    return {
      designerRegistry,
      locale: adapter.ANTD_VUE_DESIGNER_ZH_CN,
      lowCodeRegistry: createLowCodeComponentRegistry(designerRegistry),
    }
  }

  const [adapter] = await Promise.all([
    import('@moluoxixi/config-form-designer-element-plus'),
    import('element-plus/dist/index.css'),
    import('@moluoxixi/config-form-designer-element-plus/styles'),
    import('@moluoxixi/config-form-element/styles'),
  ])
  const designerRegistry = adapter.createElementPlusDesignerRegistry()
  return {
    designerRegistry,
    locale: adapter.ELEMENT_PLUS_DESIGNER_ZH_CN,
    lowCodeRegistry: createLowCodeComponentRegistry(designerRegistry),
  }
}

export function loadWorkbenchAdapter(id: WorkbenchAdapterId): Promise<WorkbenchAdapter> {
  const current = adapterPromises.get(id)
  if (current)
    return current
  const pending = createWorkbenchAdapter(id)
  adapterPromises.set(id, pending)
  return pending
}
