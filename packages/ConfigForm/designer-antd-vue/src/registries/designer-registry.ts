import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { AntdVueDesignerRegistryOptions } from '../types'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ANTD_VUE_DESIGNER_MATERIALS } from '../materials'
import { createAntdVueOptionDiagnostics } from '../options'

export const antdVueDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'antd-vue',
  materials: ANTD_VUE_DESIGNER_MATERIALS,
}

export function createAntdVueDesignerRegistry(
  options: AntdVueDesignerRegistryOptions = {},
): DesignerRegistry {
  const materials = ANTD_VUE_DESIGNER_MATERIALS.map(material => (
    ['antd.select', 'antd.auto-complete', 'antd.radio', 'antd.checkbox'].includes(material.key) && material.kind === 'field'
      ? { ...material, analyze: createAntdVueOptionDiagnostics(options.optionResolver) }
      : material
  ))
  return createDesignerRegistry({
    materials: options.materials,
    layers: [...(options.layers ?? []), { ...antdVueDesignerRegistryLayer, materials }],
    rendererNamespace: 'mx-antd-config-form',
  })
}
