import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElInput } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({
  name: 'textarea',
  order: 20,
  value: { component: ElInput, props: { type: 'textarea' } },
})
