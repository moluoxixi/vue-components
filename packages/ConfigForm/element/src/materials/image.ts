import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElImage } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'image', order: 80, value: { component: ElImage } })
