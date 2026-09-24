import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElLink } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'link', order: 110, value: { component: ElLink } })
