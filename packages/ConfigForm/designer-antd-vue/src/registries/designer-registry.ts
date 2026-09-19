import type {
  DesignerRegistry,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { AntdVueDesignerRegistryOptions } from '../types'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { ANTD_VUE_DESIGNER_MATERIALS } from '../materials'

export const antdVueDesignerRegistryLayer: DesignerRegistryLayer = {
  name: 'antd-vue',
  materials: ANTD_VUE_DESIGNER_MATERIALS,
}

export function createAntdVueDesignerRegistry(
  options: AntdVueDesignerRegistryOptions = {},
): DesignerRegistry {
  return createDesignerRegistry({
    materials: options.materials,
    layers: [...(options.layers ?? []), antdVueDesignerRegistryLayer],
    rendererNamespace: 'mx-antd-config-form',
  })
}
