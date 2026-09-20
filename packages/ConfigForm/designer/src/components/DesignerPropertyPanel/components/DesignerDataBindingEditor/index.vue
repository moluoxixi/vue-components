<script setup lang="ts">
import type {
  ComponentContract,
  DatasetReference,
  DeepReadonly,
  MaterialResourceBindingCapability,
  ProjectDataset,
  ProjectResource,
  SurfaceNode,
} from '@moluoxixi/config-form-model'
import { matchesResourceMediaType } from '@moluoxixi/config-form-model'
import { ElOption, ElSelect } from 'element-plus'
import { computed } from 'vue'
import { useDesignerLocale } from '../../../../locale'
import { DesignerDatasetBindingEditor } from './components'

const props = withDefaults(defineProps<{
  componentDefinition?: ComponentContract
  datasets?: readonly DeepReadonly<ProjectDataset>[]
  node: SurfaceNode
  readonly?: boolean
  resources?: readonly DeepReadonly<ProjectResource>[]
}>(), {
  datasets: () => [],
  readonly: false,
  resources: () => [],
})

const emit = defineEmits<{
  materializeOptions: [bindingKey: string]
  saveOptions: [bindingKey: string, name: string]
  updateDataset: [bindingKey: string, reference: DatasetReference | undefined]
  updateResource: [bindingKey: string, resourceId: string | undefined]
}>()

const locale = useDesignerLocale()
const definition = computed(() => props.componentDefinition?.key === props.node.component
  && props.componentDefinition.kind === props.node.kind
  ? props.componentDefinition
  : undefined)
const datasetCapabilities = computed(() => definition.value?.datasetBindings ?? [])
const resourceCapabilities = computed(() => definition.value?.resourceBindings ?? [])

function compatibleResources(capability: MaterialResourceBindingCapability) {
  return props.resources.filter(resource => matchesResourceMediaType(resource.mediaType, capability.mediaTypes))
}

function updateResource(bindingKey: string, value: unknown): void {
  emit('updateResource', bindingKey, typeof value === 'string' && value ? value : undefined)
}
</script>

<template>
  <section
    v-if="datasetCapabilities.length || resourceCapabilities.length"
    class="mx-config-form-designer__data-binding-editor"
    data-data-binding-editor
  >
    <header class="mx-config-form-designer__data-binding-heading">
      <strong>{{ locale.t('data.title', 'Mock data') }}</strong>
    </header>

    <DesignerDatasetBindingEditor
      v-for="capability in datasetCapabilities"
      :key="capability.key"
      :binding="node.datasetBindings?.[capability.key]"
      :capability="capability"
      :datasets="datasets"
      :has-inline-options="capability.projectionKinds.includes('options') && Array.isArray(node.props.options)"
      :node="node"
      :readonly="readonly"
      @apply="emit('updateDataset', capability.key, $event)"
      @materialize="emit('materializeOptions', capability.key)"
      @remove="emit('updateDataset', capability.key, undefined)"
      @save-options="emit('saveOptions', capability.key, $event)"
    />

    <section
      v-for="capability in resourceCapabilities"
      :key="capability.key"
      class="mx-config-form-designer__data-binding-section"
      :data-resource-binding="capability.key"
    >
      <div class="mx-config-form-designer__data-binding-title">
        <strong>{{ locale.t('data.resource.title', 'Resource') }}</strong>
        <code>{{ capability.key }}</code>
      </div>
      <label>{{ locale.t('data.resource.asset', 'Static asset') }}</label>
      <ElSelect
        :model-value="node.resourceBindings?.[capability.key]?.resourceId"
        :disabled="readonly"
        clearable
        filterable
        :aria-label="locale.t('data.resource.asset', 'Static asset')"
        :placeholder="locale.t('data.resource.select', 'Select a Resource')"
        data-resource-select
        @update:model-value="updateResource(capability.key, $event)"
      >
        <ElOption
          v-for="resource in compatibleResources(capability)"
          :key="resource.id"
          :value="resource.id"
          :label="resource.name"
        />
      </ElSelect>
      <p v-if="compatibleResources(capability).length === 0" class="mx-config-form-designer__data-binding-empty">
        {{ locale.t('data.resource.empty', 'No compatible Resource is available.') }}
      </p>
    </section>
  </section>
</template>

<style lang="scss">
@use './style/index';
</style>
