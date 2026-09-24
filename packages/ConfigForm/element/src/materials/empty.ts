import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElEmpty } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'empty', order: 160, value: { component: ElEmpty } })
