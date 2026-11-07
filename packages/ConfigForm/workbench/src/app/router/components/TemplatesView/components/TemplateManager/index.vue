<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectTemplateCatalogEntry } from '../../../../../../project'
import { ArrowRight, Copy, Eye, File, LibraryBig, PanelRight, PanelsTopLeft, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import BrowseViewToggle from '../../../../../../components/BrowseViewToggle.vue'
import { useBrowseView } from '../../../../../../components/composables/use-browse-view'
import WorkbenchCommandHint from '../../../../../../components/WorkbenchCommandHint/index.vue'
import { createPagePreviewDataUrl } from '../../../../../../features/pages'

const props = defineProps<{
  templates: readonly ProjectTemplateCatalogEntry[]
  locale?: DesignerLocaleOptions
  loading: boolean
  busy: boolean
  error: string
}>()
const emit = defineEmits<{
  create: []
  edit: [entry: ProjectTemplateCatalogEntry]
  preview: [entry: ProjectTemplateCatalogEntry]
  duplicate: [entry: ProjectTemplateCatalogEntry]
  delete: [entry: ProjectTemplateCatalogEntry]
  retry: []
}>()
const locale = computed(() => createDesignerLocale(props.locale))
const busyReason = computed(() => props.busy ? locale.value.t('library.busyReason', 'A template operation is in progress. Try again when it finishes.') : undefined)
const createDisabledReason = computed(() => props.loading ? locale.value.t('library.loadingReason', 'Templates are loading. You can create a template when loading finishes.') : busyReason.value)
const query = ref('')
const browseView = useBrowseView('templates', 'cards')
const adapter = ref('all')
const source = ref('all')
const kind = ref('all')
const searchInput = useTemplateRef<{ focus: () => void }>('searchInput')
const hasFilters = computed(() => Boolean(query.value.trim()) || adapter.value !== 'all' || source.value !== 'all' || kind.value !== 'all')
const kindIcons = { page: File, dialog: PanelsTopLeft, drawer: PanelRight }
const kinds = computed(() => [
  { label: locale.value.t('library.allKinds', 'All types'), value: 'all' },
  { label: locale.value.t('surface.kind.page', 'Page'), value: 'page' },
  { label: locale.value.t('surface.kind.dialog', 'Dialog'), value: 'dialog' },
  { label: locale.value.t('surface.kind.drawer', 'Drawer'), value: 'drawer' },
])

function templateName(entry: ProjectTemplateCatalogEntry): string {
  return locale.value.t(`template.catalog.${entry.manifest.id}.name`, entry.manifest.displayName)
}

function templateDescription(entry: ProjectTemplateCatalogEntry): string {
  return locale.value.t(`template.catalog.${entry.manifest.id}.description`, entry.manifest.description)
}

function cardName(entry: ProjectTemplateCatalogEntry): string {
  const name = templateName(entry)
  return entry.providerId === 'built-in'
    ? name.replace(/^(?:Element Plus|Ant Design Vue)\s+/u, '').replace(/^[a-z]/u, letter => letter.toUpperCase())
    : name
}

function previewImage(entry: ProjectTemplateCatalogEntry): string {
  return createPagePreviewDataUrl(entry.surface, {
    title: cardName(entry),
    subtitle: '',
    emptyLabel: locale.value.t('library.emptyDesign', 'Start with a blank canvas'),
  })
}

const filtered = computed(() => props.templates.filter((entry) => {
  if (adapter.value !== 'all' && entry.manifest.adapter !== adapter.value)
    return false
  if (source.value !== 'all' && entry.providerId !== source.value)
    return false
  if (kind.value !== 'all' && entry.surface.kind !== kind.value)
    return false
  const search = query.value.trim().toLocaleLowerCase()
  return !search || `${templateName(entry)} ${templateDescription(entry)} ${entry.manifest.tags.join(' ')}`.toLocaleLowerCase().includes(search)
}))

function clearFilters(): void {
  query.value = ''
  adapter.value = 'all'
  source.value = 'all'
  kind.value = 'all'
  void nextTick(() => searchInput.value?.focus())
}
</script>

<template>
  <main class="template-manager" :aria-label="locale.t('management.templates', 'Template management')">
    <div class="template-manager__content">
      <header class="template-manager__heading flex items-center justify-between gap-4 mb-4">
        <div>
          <h1>{{ locale.t('library.title', 'Template library') }}</h1>
        </div>
        <WorkbenchCommandHint detached :label="locale.t('library.new', 'New template')" :disabled-reason="createDisabledReason">
          <ElButton type="primary" :disabled="props.busy || props.loading" @click="emit('create')">
            <Plus :size="17" aria-hidden="true" />{{ locale.t('library.new', 'New template') }}
          </ElButton>
        </WorkbenchCommandHint>
      </header>
      <div class="template-manager__controls">
        <div class="template-manager__filters">
          <ElInput ref="searchInput" v-model="query" type="search" clearable :aria-label="locale.t('template.search', 'Search templates')" :placeholder="locale.t('template.search', 'Search templates')">
            <template #prefix>
              <Search :size="15" aria-hidden="true" />
            </template>
          </ElInput>
          <ElSelect v-model="adapter" :aria-label="locale.t('library.adapter', 'Component library')" append-to="#workbench-overlays">
            <ElOption value="all" :label="locale.t('library.allAdapters', 'All libraries')" />
            <ElOption value="element-plus" label="Element Plus" /><ElOption value="antd-vue" label="Ant Design Vue" />
          </ElSelect>
          <ElSelect v-model="source" :aria-label="locale.t('library.source', 'Template source')" append-to="#workbench-overlays">
            <ElOption value="all" :label="locale.t('library.allSources', 'All templates')" />
            <ElOption value="personal" :label="locale.t('library.personal', 'My templates')" />
            <ElOption value="built-in" :label="locale.t('library.builtIn', 'Built-in templates')" />
          </ElSelect>
        </div>
        <div class="template-manager__browse">
          <ElSegmented v-model="kind" :options="kinds" :aria-label="locale.t('library.kind', 'Template type')" />
          <div class="template-manager__results">
            <BrowseViewToggle v-model="browseView" :locale="props.locale" />
            <ElButton v-if="hasFilters" text @click="clearFilters">
              {{ locale.t('template.clearFilters', 'Clear filters') }}
            </ElButton>
            <p class="template-manager__count" aria-live="polite">
              {{ locale.t('template.resultCount', '{count} templates', { count: filtered.length }) }}
            </p>
          </div>
        </div>
      </div>
      <ElAlert v-if="props.error" type="error" :closable="false" role="alert" :title="props.error">
        <ElButton size="small" @click="emit('retry')">
          {{ locale.t('template.retryCatalog', 'Retry catalog') }}
        </ElButton>
      </ElAlert>
      <p v-if="props.loading" class="template-manager__empty" role="status">
        {{ locale.t('template.loading', 'Loading templates') }}
      </p>
      <div v-else-if="filtered.length" class="template-manager__grid" :data-view="browseView" role="list" :aria-label="locale.t('library.title', 'Template library')">
        <article v-for="entry in filtered" :key="entry.manifest.id" class="template-card" role="listitem" :data-library-template="entry.manifest.id">
          <WorkbenchCommandHint detached anchor-class="template-card__preview-hint" :label="locale.t('library.previewFor', 'Preview {name}', { name: templateName(entry) })">
            <button class="template-card__preview" type="button" :aria-label="locale.t('library.previewFor', 'Preview {name}', { name: templateName(entry) })" @click="emit('preview', entry)">
              <img :src="previewImage(entry)" alt="" width="720" height="400" loading="lazy" decoding="async">
              <span class="template-card__preview-action"><Eye :size="14" aria-hidden="true" />{{ locale.t('library.preview', 'Preview') }}</span>
            </button>
          </WorkbenchCommandHint>
          <div class="template-card__body">
            <h2 :title="cardName(entry)">
              {{ cardName(entry) }}
            </h2>
            <div class="template-card__tags">
              <span>{{ entry.manifest.adapter === 'element-plus' ? 'Element Plus' : 'Ant Design Vue' }}</span>
              <span class="template-card__kind"><component :is="kindIcons[entry.surface.kind]" :size="12" aria-hidden="true" />{{ locale.t(`surface.kind.${entry.surface.kind}`, entry.surface.kind) }}</span>
              <span class="template-card__source" :data-source="entry.providerId">{{ entry.providerId === 'personal' ? locale.t('library.personal', 'My templates') : locale.t('library.builtIn', 'Built-in templates') }}</span>
            </div>
            <p :title="templateDescription(entry)">
              {{ templateDescription(entry) }}
            </p>
          </div>
          <footer>
            <WorkbenchCommandHint v-if="browseView === 'list'" detached anchor-class="template-card__list-preview" :label="locale.t('library.previewFor', 'Preview {name}', { name: templateName(entry) })">
              <ElButton class="template-card__icon-action" text :aria-label="locale.t('library.previewFor', 'Preview {name}', { name: templateName(entry) })" @click="emit('preview', entry)">
                <Eye :size="16" aria-hidden="true" />
              </ElButton>
            </WorkbenchCommandHint>
            <WorkbenchCommandHint detached anchor-class="template-card__edit-hint" :label="entry.providerId === 'personal' ? locale.t('library.edit', 'Edit template') : locale.t('library.customize', 'Customize')" :disabled-reason="busyReason">
              <ElButton class="template-card__edit" :disabled="props.busy" :aria-label="entry.providerId === 'personal' ? locale.t('library.edit', 'Edit template') : locale.t('library.customize', 'Customize')" @click="emit('edit', entry)">
                <Pencil class="template-card__edit-icon" :size="16" aria-hidden="true" />
                <span class="template-card__edit-label">{{ entry.providerId === 'personal' ? locale.t('library.edit', 'Edit template') : locale.t('library.customize', 'Customize') }}</span>
                <ArrowRight class="template-card__edit-arrow" :size="14" aria-hidden="true" />
              </ElButton>
            </WorkbenchCommandHint>
            <WorkbenchCommandHint detached :label="locale.t('library.copyFor', 'Duplicate {name}', { name: templateName(entry) })" :disabled-reason="busyReason">
              <ElButton class="template-card__icon-action" text :disabled="props.busy" :aria-label="locale.t('library.copyFor', 'Duplicate {name}', { name: templateName(entry) })" @click="emit('duplicate', entry)">
                <Copy :size="16" aria-hidden="true" />
              </ElButton>
            </WorkbenchCommandHint>
            <WorkbenchCommandHint v-if="entry.providerId === 'personal'" detached :label="locale.t('library.deleteFor', 'Delete {name}', { name: templateName(entry) })" :disabled-reason="busyReason">
              <ElButton class="template-card__icon-action" text type="danger" :disabled="props.busy" :aria-label="locale.t('library.deleteFor', 'Delete {name}', { name: templateName(entry) })" @click="emit('delete', entry)">
                <Trash2 :size="16" aria-hidden="true" />
              </ElButton>
            </WorkbenchCommandHint>
          </footer>
        </article>
      </div>
      <div v-else class="template-manager__empty" role="status">
        <LibraryBig :size="32" aria-hidden="true" />
        <strong>{{ locale.t('template.noResults', 'No templates match these filters') }}</strong>
        <p>{{ locale.t('library.emptyHint', 'Create a template or clear the filters to browse the library.') }}</p>
        <ElButton @click="clearFilters">
          {{ locale.t('template.clearFilters', 'Clear filters') }}
        </ElButton>
      </div>
    </div>
  </main>
</template>

<style src="./style/index.css" scoped />
