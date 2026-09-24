import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElDivider } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'divider', order: 90, value: { component: ElDivider } })
