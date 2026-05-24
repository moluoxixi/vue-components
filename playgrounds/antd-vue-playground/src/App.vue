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
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="grid" tab="antd Grid 模式">
        <GridForm />
      </a-tab-pane>
      <a-tab-pane key="inline" tab="antd Inline 模式">
        <InlineForm />
      </a-tab-pane>
      <a-tab-pane key="readonly" tab="antd 只读模式">
        <ReadonlyForm />
      </a-tab-pane>
      <a-tab-pane key="nested-card-checkbox" tab="antd Card 嵌套 Checkbox">
        <NestedCardCheckboxForm />
      </a-tab-pane>
      <a-tab-pane key="nested-layout" tab="antd 嵌套布局 FormLayout">
        <NestedLayoutForm />
      </a-tab-pane>
      <a-tab-pane key="multi-card-forms" tab="antd 多 Form Card">
        <MultiCardForms />
      </a-tab-pane>
      <a-tab-pane key="i18n" tab="antd Vue I18n 表单">
        <I18nForm />
      </a-tab-pane>
    </a-tabs>
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
