import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Image } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'image', order: 90, value: { component: Image } })
