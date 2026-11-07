<script setup lang="ts">
import { ElTabPane, ElTabs } from 'element-plus'
import { shallowRef } from 'vue'
import { AntdConfigForm, ElementConfigForm } from './ConfigForm/components'

type LibraryTab = 'element' | 'antd'

const activeLibrary = shallowRef<LibraryTab>('element')
</script>

<script lang="ts">
export const exampleMeta = {
  name: 'ConfigForm',
  title: 'ConfigForm',
  category: '配置表单',
  description: '使用 Element Plus Tabs 切换 Element 和 Ant Design Vue 示例。',
  order: 40,
}
</script>

<template>
  <ElTabs v-model="activeLibrary" data-testid="config-form-library-tabs">
    <ElTabPane label="Element" name="element">
      <ElementConfigForm />
    </ElTabPane>
    <ElTabPane label="Antd" name="antd">
      <AntdConfigForm />
    </ElTabPane>
  </ElTabs>
</template>
