import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElText } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'title', order: 60, value: { component: ElText } })
