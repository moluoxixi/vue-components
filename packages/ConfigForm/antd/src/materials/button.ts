import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Button } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'button', order: 110, value: { component: Button } })
