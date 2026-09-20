import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Pagination } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({ name: 'pagination', order: 180, value: { component: Pagination } })
