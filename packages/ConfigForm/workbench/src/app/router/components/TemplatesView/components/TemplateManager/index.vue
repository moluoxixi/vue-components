<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectTemplateCatalogEntry } from '../../../../../../project'
import { ArrowRight, Copy, Eye, File, LibraryBig, PanelRight, PanelsTopLeft, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
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
const query = ref('')
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
      <header class="template-manager__heading">
        <div>
          <h1>{{ locale.t('library.title', 'Template library') }}</h1>
        </div>
        <ElButton type="primary" :disabled="busy || loading" @click="emit('create')">
          <Plus :size="17" aria-hidden="true" />{{ locale.t('library.new', 'New template') }}
        </ElButton>
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
            <ElButton v-if="hasFilters" text @click="clearFilters">
              {{ locale.t('template.clearFilters', 'Clear filters') }}
            </ElButton>
            <p class="template-manager__count" aria-live="polite">
              {{ locale.t('template.resultCount', '{count} templates', { count: filtered.length }) }}
            </p>
          </div>
        </div>
      </div>
      <ElAlert v-if="error" type="error" :closable="false" role="alert" :title="error">
        <ElButton size="small" @click="emit('retry')">
          {{ locale.t('template.retryCatalog', 'Retry catalog') }}
        </ElButton>
      </ElAlert>
      <p v-if="loading" class="template-manager__empty" role="status">
        {{ locale.t('template.loading', 'Loading templates') }}
      </p>
      <div v-else-if="filtered.length" class="template-manager__grid" role="list" :aria-label="locale.t('library.title', 'Template library')">
        <article v-for="entry in filtered" :key="entry.manifest.id" class="template-card" role="listitem" :data-library-template="entry.manifest.id">
          <button class="template-card__preview" type="button" :aria-label="locale.t('library.previewFor', 'Preview {name}', { name: templateName(entry) })" @click="emit('preview', entry)">
            <img :src="previewImage(entry)" alt="">
            <span class="template-card__kind"><component :is="kindIcons[entry.surface.kind]" :size="13" aria-hidden="true" />{{ locale.t(`surface.kind.${entry.surface.kind}`, entry.surface.kind) }}</span>
            <span class="template-card__preview-action"><Eye :size="14" aria-hidden="true" />{{ locale.t('library.preview', 'Preview') }}</span>
          </button>
          <div class="template-card__body">
            <div class="template-card__tags">
              <span>{{ entry.manifest.adapter === 'element-plus' ? 'Element Plus' : 'Ant Design Vue' }}</span><span :data-source="entry.providerId">{{ entry.providerId === 'personal' ? locale.t('library.personal', 'My templates') : locale.t('library.builtIn', 'Built-in templates') }}</span>
            </div>
            <h2>{{ cardName(entry) }}</h2>
            <p>{{ templateDescription(entry) }}</p>
          </div>
          <footer>
            <ElButton class="template-card__edit" :disabled="busy" @click="emit('edit', entry)">
              <Pencil :size="14" aria-hidden="true" />{{ entry.providerId === 'personal' ? locale.t('library.edit', 'Edit template') : locale.t('library.customize', 'Customize') }}
              <ArrowRight :size="14" aria-hidden="true" />
            </ElButton>
            <ElButton size="small" text circle :disabled="busy" :aria-label="locale.t('library.copyFor', 'Duplicate {name}', { name: templateName(entry) })" :title="locale.t('action.copy', 'Copy')" @click="emit('duplicate', entry)">
              <Copy :size="15" aria-hidden="true" />
            </ElButton>
            <ElButton v-if="entry.providerId === 'personal'" size="small" text circle type="danger" :disabled="busy" :aria-label="locale.t('library.deleteFor', 'Delete {name}', { name: templateName(entry) })" :title="locale.t('action.delete', 'Delete')" @click="emit('delete', entry)">
              <Trash2 :size="15" aria-hidden="true" />
            </ElButton>
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
