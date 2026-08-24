import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElInput } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({
  name: 'text',
  order: 10,
  value: { component: ElInput },
})
