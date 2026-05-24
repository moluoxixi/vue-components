<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'

const GridForm = defineAsyncComponent(() => import('./demos/GridForm.vue'))
const I18nForm = defineAsyncComponent(() => import('./demos/I18nForm.vue'))
const InlineForm = defineAsyncComponent(() => import('./demos/InlineForm.vue'))
const MultiCardForms = defineAsyncComponent(() => import('./demos/MultiCardForms.vue'))
const ReadonlyForm = defineAsyncComponent(() => import('./demos/ReadonlyForm.vue'))
const NestedCardCheckboxForm = defineAsyncComponent(() => import('./demos/NestedCardCheckboxForm.vue'))
const NestedLayoutForm = defineAsyncComponent(() => import('./demos/NestedLayoutForm.vue'))

const activeTab = ref('grid')
</script>

<template>
  <div class="playground-root">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="element Grid 模式" name="grid">
        <GridForm />
      </el-tab-pane>
      <el-tab-pane label="element Inline 模式" name="inline">
        <InlineForm />
      </el-tab-pane>
      <el-tab-pane label="element 只读模式" name="readonly">
        <ReadonlyForm />
      </el-tab-pane>
      <el-tab-pane label="element Card 嵌套 Checkbox" name="nested-card-checkbox">
        <NestedCardCheckboxForm />
      </el-tab-pane>
      <el-tab-pane label="element 嵌套布局 FormLayout" name="nested-layout">
        <NestedLayoutForm />
      </el-tab-pane>
      <el-tab-pane label="element 多 Form Card" name="multi-card-forms">
        <MultiCardForms />
      </el-tab-pane>
      <el-tab-pane label="Vue I18n 表单" name="i18n">
        <I18nForm />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss">
body {
  margin: 0;
  background: #fff;
}

.playground-root {
  padding: 24px;
  font-family: system-ui, sans-serif;
  background: #fff;
  min-height: 100vh;
}
</style>
