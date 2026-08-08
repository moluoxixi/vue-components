import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { ElementPlusOptionResolverContext } from './options'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ELEMENT_PLUS_DESIGNER_MATERIALS } from './materials'
import { createElementPlusOptionDiagnostics } from './options'

export const elementPlusDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'element-plus',
  materials: ELEMENT_PLUS_DESIGNER_MATERIALS,
}

export function createElementPlusDesignerRegistry(
  layers: DesignerRegistryLayer[] = [],
  options: { optionResolver?: ElementPlusOptionResolverContext } = {},
): DesignerRegistry {
  const materials = ELEMENT_PLUS_DESIGNER_MATERIALS.map(material => (
    ['element.select', 'element.radio', 'element.checkbox'].includes(material.key) && material.kind === 'field'
      ? { ...material, analyze: createElementPlusOptionDiagnostics(options.optionResolver) }
      : material
  ))
  return createDesignerRegistry([...layers, { ...elementPlusDesignerRegistryLayer, materials }])
}
