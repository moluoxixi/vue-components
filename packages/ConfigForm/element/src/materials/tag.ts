import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElTag } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'tag', order: 120, value: { component: ElTag } })
