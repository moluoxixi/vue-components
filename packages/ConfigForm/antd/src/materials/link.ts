import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { TypographyLink } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'link', order: 120, value: { component: TypographyLink } })
