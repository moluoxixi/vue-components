import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElSwitch } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({
  name: 'boolean',
  order: 40,
  value: { component: ElSwitch },
})
