import type { DesignerRegistryLayer } from '@moluoxixi/config-form-designer'
import {
  ElInput,
  ElInputNumber,
  ElSegmented,
  ElSwitch,
} from 'element-plus'

/** 设计器属性表单使用的 Element Plus 语义组件。 */
export const ELEMENT_PLUS_DESIGNER_COMPONENTS: NonNullable<DesignerRegistryLayer['components']> = {
  text: { component: ElInput, trigger: 'update:modelValue' },
  textarea: { component: ElInput, props: { type: 'textarea' }, trigger: 'update:modelValue' },
  number: { component: ElInputNumber, trigger: 'change' },
  boolean: { component: ElSwitch, trigger: 'change' },
  segmented: { component: ElSegmented, props: { block: true }, trigger: 'change' },
}
