import { withConfigFormInstall } from '@moluoxixi/config-form/renderer'
import ShadcnConfigFormSource from './src/index.vue'

export type * from './src/types'

export const ShadcnConfigForm = withConfigFormInstall(ShadcnConfigFormSource)

export default ShadcnConfigForm
