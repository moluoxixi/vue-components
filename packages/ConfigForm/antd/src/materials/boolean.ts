import type { Component } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Switch } from 'ant-design-vue'

export default defineConfigFormComponentMaterial<Component>({
  name: 'boolean',
  order: 40,
  value: { component: Switch, valueProp: 'checked', trigger: 'change' },
})
