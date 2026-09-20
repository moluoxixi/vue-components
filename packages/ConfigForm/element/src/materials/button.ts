import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElButton } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'button', order: 100, value: { component: ElButton } })
