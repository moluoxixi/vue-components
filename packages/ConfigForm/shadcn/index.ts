import { withInstall } from '@moluoxixi/config-form-headless'
import ShadcnConfigFormSource from './src/index.vue'

export type * from './src/types'

export const ShadcnConfigForm = withInstall(ShadcnConfigFormSource)

export default ShadcnConfigForm
