<script setup lang="ts">
import type { DesignerDocument, DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { ConfigFormDesigner } from '@moluoxixi/config-form-designer'
import {
  createElementPlusDesignerRegistry,
  provideElementPlusOptionResolver,
} from '@moluoxixi/config-form-designer-element-plus'
import { ref } from 'vue'
import { createDesignerSampleDocument } from './sample-document'

const props = withDefaults(defineProps<{
  locale?: DesignerLocaleOptions
  showHeader?: boolean
  showExportPreview?: boolean
}>(), {
  showExportPreview: true,
})

const optionResolver = provideElementPlusOptionResolver({
  dictionaries: {
    environments: [
      { label: 'Playground', value: 'playground' },
      { label: 'Production', value: 'production' },
    ],
  },
  providers: {
    projects: async () => [
      { label: 'Website', value: 'website' },
      { label: 'Admin console', value: 'admin' },
    ],
  },
})
const registry = createElementPlusDesignerRegistry([], { optionResolver })
const documentModel = ref<DesignerDocument>(createDesignerSampleDocument())
const lastExport = ref('')

function handleExport(json: string): void {
  lastExport.value = json
}
</script>

<template>
  <section class="designer-example" data-testid="designer-example">
    <header v-if="showHeader !== false" class="designer-example__header">
      <div>
        <h2>Visual form designer</h2>
        <p>Element Plus adapter with controlled JSON document and runtime preview.</p>
      </div>
      <span class="designer-example__version">document v{{ documentModel.version }}</span>
    </header>

    <ConfigFormDesigner
      v-model:document="documentModel"
      :registry="registry"
      :locale="props.locale"
      @export="handleExport"
    />

    <pre v-if="showExportPreview && lastExport" class="designer-example__export" data-testid="designer-export-preview">{{ lastExport }}</pre>
  </section>
</template>

<style scoped>
.designer-example {
  min-width: 0;
}

.designer-example__header {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
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
