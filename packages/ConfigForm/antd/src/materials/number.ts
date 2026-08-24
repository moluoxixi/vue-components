import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { InputNumber } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({
  name: 'number',
  order: 30,
  value: { component: InputNumber, valueProp: 'value', trigger: 'change' },
})
