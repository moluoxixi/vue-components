import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form/renderer'
import {
  ElInput,
  ElInputNumber,
  ElSelectV2,
  ElSwitch,
} from 'element-plus'

/** Element Plus 语义组件别名；调用方注册的同名 key 可以覆盖默认组件。 */
export const ELEMENT_CONFIG_FORM_COMPONENTS: ConfigFormComponentRegistry = {
  text: { component: ElInput },
  textarea: { component: ElInput, props: { type: 'textarea' } },
  number: { component: ElInputNumber },
  boolean: { component: ElSwitch },
  select: { component: ElSelectV2 },
}
