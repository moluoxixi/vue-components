import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Input } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({
  name: 'textarea',
  order: 20,
  value: { component: Input.TextArea, valueProp: 'value', trigger: 'update:value' },
})
