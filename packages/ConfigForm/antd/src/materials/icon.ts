import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { TypographyText } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'icon', order: 80, value: { component: TypographyText } })
