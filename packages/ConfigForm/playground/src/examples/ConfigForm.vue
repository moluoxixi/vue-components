<script lang="ts">
// 统一入口把两套 UI 库和设计器示例收在一个页面中，库级切换统一使用 Element Plus Tabs。
export const exampleMeta = {
  name: 'ConfigForm',
  title: 'ConfigForm',
  category: '配置表单',
  description: '使用 Element Plus Tabs 切换 Element、Ant Design Vue 和可视化设计器示例。',
  order: 40,
}
</script>

<script setup lang="ts">
import { ElTabPane, ElTabs } from 'element-plus'
import { shallowRef } from 'vue'
import AntdConfigForm from './AntdConfigForm.vue'
import DesignerConfigForm from '../designer/DesignerExample.vue'
import ElementConfigForm from './ElementConfigForm.vue'

type LibraryTab = 'element' | 'antd' | 'designer'

const activeLibrary = shallowRef<LibraryTab>('element')
</script>

<template>
  <ElTabs v-model="activeLibrary" data-testid="config-form-library-tabs">
    <ElTabPane label="Element" name="element">
      <ElementConfigForm />
    </ElTabPane>
    <ElTabPane label="Antd" name="antd">
      <AntdConfigForm />
    </ElTabPane>
    <ElTabPane label="Designer" name="designer">
      <DesignerConfigForm />
    </ElTabPane>
  </ElTabs>
</template>
