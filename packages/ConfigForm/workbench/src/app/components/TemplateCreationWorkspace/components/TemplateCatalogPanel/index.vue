<script setup lang="ts">
import type { DesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  ProjectTemplateCatalogEntry,
  ProjectTemplateCategory,
} from '../../../../../project'
import type { TemplateEligibilityDisplayStatus } from '../../types'
import { Search } from '@lucide/vue'
import { nextTick, useTemplateRef } from 'vue'

const props = defineProps<{
  catalogDiagnostics: readonly string[]
  eligibilityStatuses: Readonly<Record<string, TemplateEligibilityDisplayStatus>>
  fatalError: string
  filteredTemplates: readonly ProjectTemplateCatalogEntry[]
  loading: boolean
  locale: DesignerLocale
  providerOptions: readonly string[]
  selectedId: string
  templates: readonly ProjectTemplateCatalogEntry[]
  category: ProjectTemplateCategory | 'all'
  providerId: string
  query: string
}>()

const emit = defineEmits<{
  'clearFilters': []
  'retry': []
  'select': [id: string]
  'showDetails': []
  'update:category': [value: ProjectTemplateCategory | 'all']
  'update:providerId': [value: string]
  'update:query': [value: string]
}>()

const panel = useTemplateRef<HTMLElement>('panel')
const searchInput = useTemplateRef<{ focus?: () => void }>('searchInput')

function templateName(template: ProjectTemplateCatalogEntry): string {
  return props.locale.t(`template.catalog.${template.manifest.id}.name`, template.manifest.displayName)
}

function templateDescription(template: ProjectTemplateCatalogEntry): string {
  return props.locale.t(`template.catalog.${template.manifest.id}.description`, template.manifest.description)
}

function eligibilityLabel(status: TemplateEligibilityDisplayStatus): string {
  if (status === 'checking')
    return props.locale.t('template.statusChecking', 'Checking')
  if (status === 'eligible')
    return props.locale.t('template.statusEligible', 'Eligible')
  if (status === 'ineligible')
    return props.locale.t('template.statusIneligible', 'Incompatible')
  return props.locale.t('template.statusPending', 'Pending check')
}

function itemSelector(id: string): string {
  return `[data-template-id="${CSS.escape(id)}"]`
}

function focusTemplate(id: string): void {
  void nextTick(() => panel.value?.querySelector<HTMLElement>(itemSelector(id))?.focus())
}

function moveSelection(event: KeyboardEvent, currentId: string): void {
  const ids = props.filteredTemplates.map(template => template.manifest.id)
  const current = Math.max(0, ids.indexOf(currentId))
  const next = event.key === 'ArrowDown'
    ? Math.min(ids.length - 1, current + 1)
    : event.key === 'ArrowUp'
      ? Math.max(0, current - 1)
      : event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? ids.length - 1
          : undefined

  if (event.key === 'Enter') {
    event.preventDefault()
    emit('select', currentId)
    emit('showDetails')
    return
  }
  if (next === undefined || !ids[next])
    return
  event.preventDefault()
  emit('select', ids[next])
  focusTemplate(ids[next])
}

function activateTemplate(id: string): void {
  emit('select', id)
  emit('showDetails')
}

function focusSearch(): void {
  searchInput.value?.focus?.()
}

defineExpose({ focusSearch, focusTemplate })
</script>

<template>
  <div ref="panel" class="template-catalog-panel">
    <div class="template-catalog-filters">
      <ElInput
        ref="searchInput"
        :model-value="props.query"
        type="search"
        clearable
        :placeholder="props.locale.t('template.search', 'Search templates')"
        :aria-label="props.locale.t('template.search', 'Search templates')"
        @update:model-value="emit('update:query', $event)"
      >
        <template #prefix>
          <Search :size="15" aria-hidden="true" />
        </template>
      </ElInput>
      <div>
        <ElSelect
          :model-value="props.category"
          :aria-label="props.locale.t('template.category', 'Template category')"
          append-to="#workbench-overlays"
          @update:model-value="emit('update:category', $event)"
        >
          <ElOption value="all" :label="props.locale.t('template.categoryAll', 'All categories')" />
          <ElOption value="blank" :label="props.locale.t('template.categoryBlank', 'Blank')" />
          <ElOption value="starter" :label="props.locale.t('template.categoryStarter', 'Starter')" />
        </ElSelect>
        <ElSelect
          :model-value="props.providerId"
          :aria-label="props.locale.t('template.provider', 'Template source')"
          append-to="#workbench-overlays"
          @update:model-value="emit('update:providerId', $event)"
        >
          <ElOption value="all" :label="props.locale.t('template.providerAll', 'All templates')" />
          <ElOption v-for="provider in props.providerOptions" :key="provider" :value="provider" :label="provider === 'built-in' ? props.locale.t('library.builtIn', 'Built-in templates') : props.locale.t('library.personal', 'My templates')" />
        </ElSelect>
      </div>
      <span class="template-catalog-count" aria-live="polite">
        {{ props.locale.t('template.resultCount', '{count} templates', { count: props.filteredTemplates.length }) }}
      </span>
    </div>

    <div class="template-catalog-results">
      <p v-if="props.loading" class="template-state" role="status">
        {{ props.locale.t('template.loading', 'Loading templates') }}
      </p>

      <div v-else-if="props.fatalError" class="template-catalog-fatal" role="alert">
        <strong>{{ props.locale.t('template.catalogFailed', 'Template catalog unavailable') }}</strong>
        <span>{{ props.fatalError }}</span>
        <ElButton native-type="button" @click="emit('retry')">
          {{ props.locale.t('template.retryCatalog', 'Retry catalog') }}
        </ElButton>
      </div>

      <template v-else>
        <div v-if="props.catalogDiagnostics.length" class="template-provider-error" role="alert">
          <strong>{{ props.locale.t('template.providerWarning', 'Some templates could not be loaded') }}</strong>
          <p v-for="diagnostic in props.catalogDiagnostics" :key="diagnostic">
            {{ diagnostic }}
          </p>
          <ElButton native-type="button" size="small" @click="emit('retry')">
            {{ props.locale.t('template.retryCatalog', 'Retry catalog') }}
          </ElButton>
        </div>

        <div
          v-if="props.filteredTemplates.length"
          class="template-catalog-list"
          role="listbox"
          :aria-label="props.locale.t('template.available', 'Available templates')"
        >
          <button
            v-for="template in props.filteredTemplates"
            :key="template.manifest.id"
            type="button"
            role="option"
            class="template-catalog-item"
            :class="{ 'is-selected': props.selectedId === template.manifest.id }"
            :aria-selected="props.selectedId === template.manifest.id"
            :data-template-id="template.manifest.id"
            :tabindex="props.selectedId === template.manifest.id ? 0 : -1"
            @click="activateTemplate(template.manifest.id)"
            @keydown="moveSelection($event, template.manifest.id)"
          >
            <span class="template-catalog-rail" aria-hidden="true" />
            <span class="template-catalog-copy">
              <strong>{{ templateName(template) }}</strong>
              <span>{{ templateDescription(template) }}</span>
              <small>{{ props.locale.t(`surface.kind.${template.surface.kind}`, template.surface.kind) }} · {{ template.manifest.adapter === 'element-plus' ? 'Element Plus' : 'Ant Design Vue' }} · {{ template.providerId === 'built-in' ? props.locale.t('library.builtIn', 'Built-in templates') : props.locale.t('library.personal', 'My templates') }}</small>
            </span>
            <span
              v-if="props.eligibilityStatuses[template.manifest.id] && props.eligibilityStatuses[template.manifest.id] !== 'eligible'"
              class="template-catalog-status"
              :data-status="props.eligibilityStatuses[template.manifest.id] ?? 'pending'"
            >
              {{ eligibilityLabel(props.eligibilityStatuses[template.manifest.id] ?? 'pending') }}
            </span>
          </button>
        </div>

        <div v-else-if="props.templates.length" class="template-empty-state" role="status">
          <strong>{{ props.locale.t('template.noResults', 'No templates match these filters') }}</strong>
          <span>{{ props.locale.t('template.noResultsHint', 'Clear search or choose another category or provider.') }}</span>
          <ElButton native-type="button" @click="emit('clearFilters')">
            {{ props.locale.t('template.clearFilters', 'Clear filters') }}
          </ElButton>
        </div>

        <div v-else class="template-empty-state" role="status">
          <strong>{{ props.locale.t('template.noTemplates', 'No templates are available') }}</strong>
          <span>{{ props.locale.t('template.noTemplatesHint', 'Retry the catalog providers to load templates.') }}</span>
          <ElButton native-type="button" @click="emit('retry')">
            {{ props.locale.t('template.retryCatalog', 'Retry catalog') }}
          </ElButton>
        </div>
      </template>
    </div>
  </div>
</template>
