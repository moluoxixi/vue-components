<script setup lang="ts">
import type { DesignerDocument } from '@moluoxixi/config-form-designer'
import { ConfigFormDesigner } from '@moluoxixi/config-form-designer'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { ref } from 'vue'

const registry = createElementPlusDesignerRegistry()

const documentModel = ref<DesignerDocument>({
  version: 1,
  form: {
    columns: 2,
    gap: '16px',
    fieldSpan: 1,
  },
  nodes: [
    {
      id: 'designer-section',
      kind: 'container',
      material: 'element.section',
      props: {
        title: 'Account details',
        description: 'Edit the structure and preview the real Element Plus form.',
      },
      slots: {
        default: [
          {
            id: 'designer-name',
            kind: 'field',
            material: 'element.input',
            field: 'name',
            label: 'Name',
            props: { placeholder: 'Your name' },
            validation: {
              version: 1,
              base: { type: 'string' },
              rules: [
                { kind: 'required', message: 'Please enter your name' },
                { kind: 'minLength', value: 2, message: 'Use at least two characters' },
              ],
            },
          },
        ],
      },
    },
    {
      id: 'designer-card',
      kind: 'container',
      material: 'element.card',
      props: { header: 'Preferences', shadow: 'never' },
      slots: {
        default: [
          {
            id: 'designer-choice',
            kind: 'field',
            material: 'element.select',
            field: 'choice',
            label: 'Choice',
            defaultValue: 'a',
            props: {
              options: [
                { label: 'Option A', value: 'a' },
                { label: 'Option B', value: 'b' },
              ],
              placeholder: 'Choose one',
            },
          },
        ],
      },
    },
    {
      id: 'designer-enabled',
      kind: 'field',
      material: 'element.switch',
      field: 'enabled',
      label: 'Enabled',
      defaultValue: true,
    },
  ],
})

const lastExport = ref('')

function handleExport(json: string): void {
  lastExport.value = json
}
</script>

<template>
  <section class="designer-example" data-testid="designer-example">
    <header class="designer-example__header">
      <div>
        <h2>Visual form designer</h2>
        <p>Element Plus adapter with controlled JSON document and runtime preview.</p>
      </div>
      <span class="designer-example__version">document v{{ documentModel.version }}</span>
    </header>

    <ConfigFormDesigner
      v-model:document="documentModel"
      :registry="registry"
      @export="handleExport"
    />

    <pre v-if="lastExport" class="designer-example__export" data-testid="designer-export-preview">{{ lastExport }}</pre>
  </section>
</template>

<style scoped>
.designer-example {
  min-width: 0;
}

.designer-example__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.designer-example__header h2,
.designer-example__header p {
  margin: 0;
}

.designer-example__header h2 {
  color: var(--el-text-color-primary);
  font-size: 20px;
}

.designer-example__header p {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.designer-example__version {
  flex: none;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}

.designer-example__export {
  max-height: 220px;
  margin: 16px 0 0;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-regular);
  font-size: 12px;
}
</style>
