import type { DesignerPropertyControlRegistry } from '@moluoxixi/config-form-designer'
import {
  ElInput,
  ElInputNumber,
  ElSegmented,
  ElSwitch,
} from 'element-plus'

export const ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS: DesignerPropertyControlRegistry = {
  text: {
    component: ElInput,
    trigger: 'update:modelValue',
  },
  textarea: {
    component: ElInput,
    trigger: 'update:modelValue',
    props: { type: 'textarea' },
  },
  number: {
    component: ElInputNumber,
    trigger: 'change',
  },
  boolean: {
    component: ElSwitch,
    trigger: 'change',
  },
  select: {
    component: ElSegmented,
    trigger: 'change',
    props: { block: true },
  },
}
