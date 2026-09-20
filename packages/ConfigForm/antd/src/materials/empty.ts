import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Empty } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'empty', order: 170, value: { component: Empty } })
