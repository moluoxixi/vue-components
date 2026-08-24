import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Input } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({
  name: 'text',
  order: 10,
  value: { component: Input, valueProp: 'value', trigger: 'update:value' },
})
