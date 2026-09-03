import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { ElementPlusDesignerRegistryOptions } from '../types'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ELEMENT_PLUS_DESIGNER_MATERIALS } from '../materials'
import { createElementPlusOptionDiagnostics } from '../options'
import { ELEMENT_PLUS_DESIGNER_COMPONENTS } from './components'
import { ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS } from './property-controls'

export const elementPlusDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'element-plus',
  components: ELEMENT_PLUS_DESIGNER_COMPONENTS,
  materials: ELEMENT_PLUS_DESIGNER_MATERIALS,
  propertyControls: ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS,
}

export function createElementPlusDesignerRegistry(
  options: ElementPlusDesignerRegistryOptions = {},
): DesignerRegistry {
  const materials = ELEMENT_PLUS_DESIGNER_MATERIALS.map(material => (
    ['element.select', 'element.radio', 'element.checkbox'].includes(material.key) && material.kind === 'field'
      ? { ...material, analyze: createElementPlusOptionDiagnostics(options.optionResolver) }
      : material
  ))
  const consumerLayers: DesignerRegistryLayer[] = options.materials
    ? [{ name: 'consumer-materials', materials: options.materials }]
    : []
  return createDesignerRegistry(
    [...consumerLayers, ...(options.layers ?? []), { ...elementPlusDesignerRegistryLayer, materials }],
    { rendererNamespace: 'mx-element-config-form' },
  )
}
