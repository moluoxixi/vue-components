import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Alert } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'alert', order: 140, value: { component: Alert } })
