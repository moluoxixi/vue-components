import { withInstall } from '@moluoxixi/config-form-core'
import ShadcnConfigFormSource from './src/index.vue'

export type * from './src/types'

export const ShadcnConfigForm = withInstall(ShadcnConfigFormSource)

export default ShadcnConfigForm
