import type { DesignerPropertyControlRegistry } from '@moluoxixi/config-form-designer'
import {
  Input,
  InputNumber,
  Segmented,
  Switch,
} from 'ant-design-vue'

export const ANTD_VUE_DESIGNER_PROPERTY_CONTROLS: DesignerPropertyControlRegistry = {
  text: {
    component: Input,
    valueProp: 'value',
    trigger: 'update:value',
  },
  textarea: {
    component: Input.TextArea,
    valueProp: 'value',
    trigger: 'update:value',
  },
  number: {
    component: InputNumber,
    valueProp: 'value',
    trigger: 'change',
  },
  boolean: {
    component: Switch,
    valueProp: 'checked',
    trigger: 'change',
  },
  select: {
    component: Segmented,
    valueProp: 'value',
    trigger: 'change',
    props: { block: true },
  },
}
