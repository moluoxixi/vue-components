import { withConfigFormInstall } from '@moluoxixi/config-form/renderer'
import ElementConfigFormSource from './src/index.vue'

export {
  ELEMENT_CONFIG_FORM_COMPONENTS,
  ELEMENT_CONFIG_FORM_MATERIAL_REGISTRY,
} from './src/components'
export type * from './src/types'

export const ElementConfigForm = withConfigFormInstall(ElementConfigFormSource)

export default ElementConfigForm
