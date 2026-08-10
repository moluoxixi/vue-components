import type { DesignerRegistryLayer } from '@moluoxixi/config-form-designer'
import {
  Input,
  InputNumber,
  Segmented,
  Switch,
} from 'ant-design-vue'

/** 设计器属性表单使用的 Ant Design Vue 语义组件。 */
export const ANTD_VUE_DESIGNER_COMPONENTS: NonNullable<DesignerRegistryLayer['components']> = {
  text: { component: Input, valueProp: 'value', trigger: 'update:value' },
  textarea: { component: Input.TextArea, valueProp: 'value', trigger: 'update:value' },
  number: { component: InputNumber, valueProp: 'value', trigger: 'change' },
  boolean: { component: Switch, valueProp: 'checked', trigger: 'change' },
  segmented: { component: Segmented, props: { block: true }, valueProp: 'value', trigger: 'change' },
}
