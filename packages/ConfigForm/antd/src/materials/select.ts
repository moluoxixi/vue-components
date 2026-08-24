import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Select } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({
  name: 'select',
  order: 50,
  value: { component: Select, valueProp: 'value', trigger: 'change' },
})
