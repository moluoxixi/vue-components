import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElIcon } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'icon', order: 70, value: { component: ElIcon } })
