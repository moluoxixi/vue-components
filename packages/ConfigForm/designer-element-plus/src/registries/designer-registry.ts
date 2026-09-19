import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { ElementPlusDesignerRegistryOptions } from '../types'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ELEMENT_PLUS_DESIGNER_MATERIALS } from '../materials'
import { ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS } from './property-controls'

export const elementPlusDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'element-plus',
  materials: ELEMENT_PLUS_DESIGNER_MATERIALS,
  propertyControls: ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS,
}

export function createElementPlusDesignerRegistry(
  options: ElementPlusDesignerRegistryOptions = {},
): DesignerRegistry {
  return createDesignerRegistry({
    materials: options.materials,
    layers: [...(options.layers ?? []), elementPlusDesignerRegistryLayer],
    rendererNamespace: 'mx-element-config-form',
  })
}
