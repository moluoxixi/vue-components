import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Segmented } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({
  name: 'segmented',
  order: 60,
  value: { component: Segmented, valueProp: 'value', trigger: 'change' },
})
