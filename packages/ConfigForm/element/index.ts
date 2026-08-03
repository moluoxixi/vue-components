import { withConfigFormInstall } from '@moluoxixi/config-form/renderer'
import ElementConfigFormSource from './src/index.vue'

export type * from './src/types'

export const ElementConfigForm = withConfigFormInstall(ElementConfigFormSource)

export default ElementConfigForm
