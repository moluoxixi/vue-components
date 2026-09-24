import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElPagination } from 'element-plus'

export default defineConfigFormComponentMaterial<Component>({ name: 'pagination', order: 170, value: { component: ElPagination } })
