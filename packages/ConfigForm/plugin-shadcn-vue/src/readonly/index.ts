import type { ReadonlyAdapterRegistry } from '@moluoxixi/config-form/plugins'
import {
  createRawReadonlyAdapter,
  createShadcnChoiceReadonlyAdapter,
} from './adapters'

const rawReadonlyAdapter = createRawReadonlyAdapter()

/** shadcn-vue 字段组件的只读展示适配表。 */
export const SHADCN_VUE_READONLY_ADAPTERS: ReadonlyAdapterRegistry = Object.freeze({
  Input: rawReadonlyAdapter,
  NativeSelect: createShadcnChoiceReadonlyAdapter(),
  Textarea: rawReadonlyAdapter,
})

export {
  createRawReadonlyAdapter,
  createShadcnChoiceReadonlyAdapter,
} from './adapters'
