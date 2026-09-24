import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { TypographyTitle } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'title', order: 70, value: { component: TypographyTitle } })
