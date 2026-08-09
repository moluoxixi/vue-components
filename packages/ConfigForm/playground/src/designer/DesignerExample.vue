<script setup lang="ts">
import type { DesignerDocument, DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { ConfigFormDesigner } from '@moluoxixi/config-form-designer'
import {
  createAntdVueDesignerRegistry,
  provideAntdVueOptionResolver,
} from '@moluoxixi/config-form-designer-antd-vue'
import {
  createElementPlusDesignerRegistry,
  provideElementPlusOptionResolver,
} from '@moluoxixi/config-form-designer-element-plus'
import { computed, ref, shallowRef } from 'vue'
import { createDesignerSampleDocument } from './sample-document'
import type { DesignerAdapter } from './sample-document'

const props = withDefaults(defineProps<{
  locale?: DesignerLocaleOptions
  adapter?: DesignerAdapter
  showHeader?: boolean
  showExportPreview?: boolean
}>(), {
  adapter: 'element-plus',
  showExportPreview: true,
})

const optionResolverConfig = {
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
}
const elementOptionResolver = provideElementPlusOptionResolver(optionResolverConfig)
const antdOptionResolver = provideAntdVueOptionResolver(optionResolverConfig)
const registries = {
  'element-plus': createElementPlusDesignerRegistry([], { optionResolver: elementOptionResolver }),
  'antd-vue': createAntdVueDesignerRegistry([], { optionResolver: antdOptionResolver }),
}
const elementDocument = shallowRef<DesignerDocument>(createDesignerSampleDocument('element-plus'))
const antdDocument = shallowRef<DesignerDocument>(createDesignerSampleDocument('antd-vue'))
const registry = computed(() => registries[props.adapter])
const documentModel = computed({
  get: (): DesignerDocument => props.adapter === 'element-plus' ? elementDocument.value : antdDocument.value,
  set: (value: DesignerDocument): void => {
    if (props.adapter === 'element-plus')
      elementDocument.value = value
    else
      antdDocument.value = value
  },
})
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
        <p>{{ props.adapter === 'element-plus' ? 'Element Plus' : 'Ant Design Vue' }} adapter with controlled JSON document and runtime preview.</p>
      </div>
      <span class="designer-example__version">document v{{ documentModel.version }}</span>
    </header>

    <ConfigFormDesigner
      :key="props.adapter"
      v-model:document="documentModel"
      :registry="registry"
      :locale="props.locale"
      :data-adapter="props.adapter"
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
