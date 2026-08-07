import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ELEMENT_PLUS_DESIGNER_MATERIALS } from './materials'

export const elementPlusDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'element-plus',
  materials: ELEMENT_PLUS_DESIGNER_MATERIALS,
}

export function createElementPlusDesignerRegistry(
  layers: DesignerRegistryLayer[] = [],
): DesignerRegistry {
  return createDesignerRegistry([...layers, elementPlusDesignerRegistryLayer])
}
