import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElInputNumber } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({
  name: 'number',
  order: 30,
  value: { component: ElInputNumber },
})
