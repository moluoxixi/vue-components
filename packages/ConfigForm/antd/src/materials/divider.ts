import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Divider } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'divider', order: 100, value: { component: Divider } })
