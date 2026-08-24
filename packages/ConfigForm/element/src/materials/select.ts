import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElSelectV2 } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({
  name: 'select',
  order: 50,
  value: { component: ElSelectV2 },
})
