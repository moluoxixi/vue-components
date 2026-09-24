import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElAlert } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'alert', order: 130, value: { component: ElAlert } })
