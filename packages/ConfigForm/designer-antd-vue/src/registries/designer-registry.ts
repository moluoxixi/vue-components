import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { AntdVueDesignerRegistryOptions } from '../types'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ANTD_VUE_DESIGNER_MATERIALS } from '../materials'
import { createAntdVueOptionDiagnostics } from '../options'
import { ANTD_VUE_DESIGNER_COMPONENTS } from './components'
import { ANTD_VUE_DESIGNER_PROPERTY_CONTROLS } from './property-controls'

export const antdVueDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'antd-vue',
  components: ANTD_VUE_DESIGNER_COMPONENTS,
  materials: ANTD_VUE_DESIGNER_MATERIALS,
  propertyControls: ANTD_VUE_DESIGNER_PROPERTY_CONTROLS,
}

export function createAntdVueDesignerRegistry(
  options: AntdVueDesignerRegistryOptions = {},
): DesignerRegistry {
  const materials = ANTD_VUE_DESIGNER_MATERIALS.map(material => (
    ['antd.select', 'antd.auto-complete', 'antd.radio', 'antd.checkbox'].includes(material.key) && material.kind === 'field'
      ? { ...material, analyze: createAntdVueOptionDiagnostics(options.optionResolver) }
      : material
  ))
  const consumerLayers: DesignerRegistryLayer[] = options.materials
    ? [{ name: 'consumer-materials', materials: options.materials }]
    : []
  return createDesignerRegistry(
    [...consumerLayers, ...(options.layers ?? []), { ...antdVueDesignerRegistryLayer, materials }],
    { rendererNamespace: 'mx-antd-config-form' },
  )
}
