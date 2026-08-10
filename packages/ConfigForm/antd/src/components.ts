import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form/renderer'
import {
  Input,
  InputNumber,
  Segmented,
  Select,
  Switch,
} from 'ant-design-vue'

/** Ant Design Vue 语义组件别名；调用方注册的同名 key 可以覆盖默认组件。 */
export const ANTD_CONFIG_FORM_COMPONENTS: ConfigFormComponentRegistry = {
  text: { component: Input, valueProp: 'value', trigger: 'update:value' },
  textarea: { component: Input.TextArea, valueProp: 'value', trigger: 'update:value' },
  number: { component: InputNumber, valueProp: 'value', trigger: 'change' },
  boolean: { component: Switch, valueProp: 'checked', trigger: 'change' },
  select: { component: Select, valueProp: 'value', trigger: 'change' },
  segmented: { component: Segmented, valueProp: 'value', trigger: 'change' },
}
