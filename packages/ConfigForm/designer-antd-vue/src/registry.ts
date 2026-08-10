import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { AntdVueOptionResolverContext } from './options'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ANTD_VUE_DESIGNER_COMPONENTS } from './components'
import { ANTD_VUE_DESIGNER_MATERIALS } from './materials'
import { createAntdVueOptionDiagnostics } from './options'
import { ANTD_VUE_DESIGNER_PROPERTY_CONTROLS } from './propertyControls'

export const antdVueDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'antd-vue',
  components: ANTD_VUE_DESIGNER_COMPONENTS,
  materials: ANTD_VUE_DESIGNER_MATERIALS,
  propertyControls: ANTD_VUE_DESIGNER_PROPERTY_CONTROLS,
}

export function createAntdVueDesignerRegistry(
  layers: DesignerRegistryLayer[] = [],
  options: { optionResolver?: AntdVueOptionResolverContext } = {},
): DesignerRegistry {
  const materials = ANTD_VUE_DESIGNER_MATERIALS.map(material => (
    ['antd.select', 'antd.auto-complete', 'antd.radio', 'antd.checkbox'].includes(material.key) && material.kind === 'field'
      ? { ...material, analyze: createAntdVueOptionDiagnostics(options.optionResolver) }
      : material
  ))
  return createDesignerRegistry(
    [...layers, { ...antdVueDesignerRegistryLayer, materials }],
    { rendererNamespace: 'mx-antd-config-form' },
  )
}
