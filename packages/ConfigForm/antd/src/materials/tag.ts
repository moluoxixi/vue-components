import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Tag } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'tag', order: 130, value: { component: Tag } })
