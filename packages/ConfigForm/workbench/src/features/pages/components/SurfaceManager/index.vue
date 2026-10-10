<script setup lang="ts">
import type { SurfaceManagerEmits, SurfaceManagerProps } from './types'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  FileJson2,
  FilePlus2,
  Files,
  Home,
  LibraryBig,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, watch } from 'vue'
import { createPagePreviewDataUrl } from '../../services'
import { SurfacePresentationEditor } from './components'

const props = defineProps<SurfaceManagerProps>()

const emit = defineEmits<SurfaceManagerEmits>()

const search = ref('')
const names = ref<Record<string, string>>({})
const routes = ref<Record<string, string>>({})
const pendingDeleteId = ref<string>()
const editingPresentationId = ref<string>()
const editingId = ref<string>()
const nameInputRefs = new Map<string, { focus?: () => void }>()
const locale = computed(() => createDesignerLocale(props.locale))

const surfaces = computed(() => props.project.surfaceOrder.map(id => props.project.surfacesById[id]!).filter(Boolean))

watch(surfaces, (items) => {
  names.value = Object.fromEntries(items.map(surface => [surface.id, surface.name]))
  routes.value = Object.fromEntries(items.flatMap(surface => surface.kind === 'page' ? [[surface.id, surface.route]] : []))
  if (pendingDeleteId.value && !items.some(surface => surface.id === pendingDeleteId.value))
    pendingDeleteId.value = undefined
  if (editingId.value && !items.some(surface => surface.id === editingId.value))
    editingId.value = undefined
}, { deep: true, immediate: true })

/**
 * Rows are read-only until a row is explicitly put into edit mode: the list is a
 * browsing surface, and inline inputs on every row read as a bulk editor.
 */
function beginEdit(surfaceId: string): void {
  if (editingId.value && editingId.value !== surfaceId)
    finishEdit()
  editingId.value = surfaceId
  void nextTick(() => nameInputRefs.get(surfaceId)?.focus?.())
}

function setNameInputRef(surfaceId: string, instance: unknown): void {
  if (instance && typeof instance === 'object' && 'focus' in instance && typeof instance.focus === 'function')
    nameInputRefs.set(surfaceId, instance as { focus: () => void })
  else
    nameInputRefs.delete(surfaceId)
}

function finishEdit(): void {
  const surfaceId = editingId.value
  if (!surfaceId)
    return
  commitName(surfaceId)
  commitRoute(surfaceId)
  editingId.value = undefined
}

function cancelEdit(): void {
  const surfaceId = editingId.value
  const current = surfaceId ? props.project.surfacesById[surfaceId] : undefined
  if (surfaceId && current) {
    names.value[surfaceId] = current.name
    if (current.kind === 'page')
      routes.value[surfaceId] = current.route
  }
  editingId.value = undefined
}

const filteredSurfaces = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query)
    return surfaces.value
  return surfaces.value.filter(surface => `${surface.name} ${surface.kind === 'page' ? surface.route : surface.kind}`.toLocaleLowerCase().includes(query))
})

const pageStats = computed(() => ({
  pages: surfaces.value.filter(surface => surface.kind === 'page').length,
  dialogs: surfaces.value.filter(surface => surface.kind === 'dialog').length,
  drawers: surfaces.value.filter(surface => surface.kind === 'drawer').length,
  total: surfaces.value.length,
}))

function surfaceKindLabel(kind: 'page' | 'dialog' | 'drawer'): string {
  if (kind === 'dialog')
    return locale.value.t('surface.kind.dialog', 'Dialog')
  if (kind === 'drawer')
    return locale.value.t('surface.kind.drawer', 'Drawer')
  return locale.value.t('surface.kind.page', 'Page')
}

const pendingDeleteSurface = computed(() => surfaces.value.find(surface => surface.id === pendingDeleteId.value))

function commitName(surfaceId: string): void {
  const value = names.value[surfaceId]?.trim()
  const current = props.project.surfacesById[surfaceId]
  if (!value || !current) {
    names.value[surfaceId] = current?.name ?? ''
    return
  }
  if (value !== current.name)
    emit('action', { type: 'surface.rename', surfaceId, name: value })
}

function commitRoute(surfaceId: string): void {
  const value = routes.value[surfaceId]?.trim()
  const current = props.project.surfacesById[surfaceId]
  if (!value || current?.kind !== 'page') {
    routes.value[surfaceId] = current?.kind === 'page' ? current.route : ''
    return
  }
  if (value !== current.route)
    emit('action', { type: 'surface.route', surfaceId, route: value })
}

function handleTextKeydown(event: Event | KeyboardEvent): void {
  if ('key' in event && event.key === 'Enter')
    (event.currentTarget as HTMLInputElement).blur()
}

function moveSurface(surfaceId: string, offset: number): void {
  const index = props.project.surfaceOrder.indexOf(surfaceId)
  if (index >= 0)
    emit('action', { type: 'surface.move', surfaceId, index: index + offset })
}

function confirmDelete(): void {
  if (!pendingDeleteId.value)
    return
  emit('action', { type: 'surface.remove', surfaceId: pendingDeleteId.value })
  pendingDeleteId.value = undefined
}

function previewImage(page: typeof surfaces.value[number]): string {
  return createPagePreviewDataUrl(page)
}

function exportPage(surfaceId: string): void {
  emit('export', surfaceId)
}

function exportPageSource(surfaceId: string): void {
  emit('exportSource', surfaceId)
}
</script>

<template>
  <section class="page-manager" :aria-label="locale.t('pageManager.title', 'Page management')">
    <slot name="header" :stats="pageStats">
      <header class="page-manager__header">
        <nav class="page-manager__breadcrumb" :aria-label="locale.t('pageManager.breadcrumb', 'Breadcrumb')">
          <ElButton native-type="button" link class="page-manager__breadcrumb-link" @click="emit('openProjects')">
            <ArrowLeft :size="14" aria-hidden="true" />
            {{ locale.t('pageManager.backToProjects', 'Back to projects') }}
          </ElButton>
          <span class="page-manager__breadcrumb-divider" aria-hidden="true">/</span>
          <span aria-current="page">{{ locale.t('pageManager.title', 'Page management') }}</span>
        </nav>
        <h1 class="page-manager__project-name" :title="project.name">
          {{ project.name }}
        </h1>
        <div class="page-manager__header-summary" :aria-label="locale.t('pageManager.summary', 'Page summary')">
          <span>{{ surfaceKindLabel('page') }}<strong>{{ pageStats.pages }}</strong></span>
          <span>{{ surfaceKindLabel('dialog') }}<strong>{{ pageStats.dialogs }}</strong></span>
          <span>{{ surfaceKindLabel('drawer') }}<strong>{{ pageStats.drawers }}</strong></span>
        </div>
      </header>
    </slot>

    <div class="page-manager__toolbar">
      <h2 class="page-manager__list-title">
        {{ locale.t('pageManager.projectSurfaces', 'Project pages') }}
        <span>{{ pageStats.total }}</span>
      </h2>
      <label class="page-manager__search">
        <span class="sr-only">{{ locale.t('pageManager.search', 'Search pages') }}</span>
        <ElInput v-model="search" type="search" clearable :placeholder="locale.t('pageManager.search', 'Search pages')" :aria-label="locale.t('pageManager.search', 'Search pages')">
          <template #prefix>
            <Search :size="15" aria-hidden="true" />
          </template>
        </ElInput>
      </label>
      <div class="page-manager__create-actions">
        <ElButton data-create-trigger="page-manager-import-surface" native-type="button" :disabled="busy" @click="emit('importSurface')">
          <FileJson2 :size="16" aria-hidden="true" />
          {{ locale.t('pages.import', 'Import page') }}
        </ElButton>
        <ElButton data-create-trigger="page-manager-template" native-type="button" :disabled="busy" @click="emit('useTemplate')">
          <LibraryBig :size="16" aria-hidden="true" />{{ locale.t('pages.fromTemplate', 'From template') }}
        </ElButton>
        <ElButtonGroup class="page-manager__new-group">
          <ElButton data-create-trigger="page-manager-new-surface" native-type="button" type="primary" :disabled="busy" @click="emit('createSurface', 'page')">
            <FilePlus2 :size="16" aria-hidden="true" />
            {{ locale.t('pages.new', 'New page') }}
          </ElButton>
          <ElDropdown trigger="click" placement="bottom-end" append-to="#workbench-overlays" @command="emit('createSurface', $event)">
            <ElButton type="primary" :disabled="busy" :aria-label="locale.t('pages.newType', 'Choose page type')">
              <ChevronDown :size="15" aria-hidden="true" />
            </ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem command="page" :disabled="busy">
                  {{ locale.t('pages.new', 'New page') }}
                </ElDropdownItem>
                <ElDropdownItem command="dialog" :disabled="busy">
                  {{ locale.t('pages.newDialog', 'New dialog') }}
                </ElDropdownItem>
                <ElDropdownItem command="drawer" :disabled="busy">
                  {{ locale.t('pages.newDrawer', 'New drawer') }}
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </ElButtonGroup>
      </div>
    </div>

    <div class="page-manager__table" role="list" tabindex="0" :aria-label="locale.t('pageManager.projectSurfaces', 'Project pages')">
      <article
        v-for="page in filteredSurfaces"
        :key="page.id"
        class="page-manager__row"
        role="listitem"
        @keydown.esc="cancelEdit"
      >
        <button type="button" class="page-manager__preview-button" :disabled="busy" :aria-label="locale.t('pageManager.previewAlt', 'Preview of {name}', { name: page.name })" @click="emit('openPage', page.id)">
          <img class="page-manager__preview" :src="previewImage(page)" alt="">
          <span class="page-manager__preview-kind" :data-kind="page.kind">{{ surfaceKindLabel(page.kind) }}</span>
          <span v-if="project.homeSurfaceId === page.id" class="page-manager__preview-home"><Home :size="12" aria-hidden="true" />{{ locale.t('pageManager.home', 'Home page') }}</span>
        </button>
        <div class="page-manager__name-cell">
          <div class="page-manager__name-content">
            <span class="sr-only">{{ locale.t('pageManager.pageName', 'Page name') }}</span>
            <template v-if="editingId === page.id">
              <ElInput
                :ref="(instance: unknown) => setNameInputRef(page.id, instance)"
                v-model="names[page.id]"
                size="small"
                :disabled="busy"
                :aria-label="locale.t('pageManager.pageNameAria', 'Page name for {name}', { name: page.name })"
                @blur="commitName(page.id)"
                @keydown.enter="handleTextKeydown"
                @keydown.esc="cancelEdit"
              />
              <ElInput
                v-if="page.kind === 'page'"
                v-model="routes[page.id]"
                class="page-manager__route-input"
                size="small"
                :disabled="busy"
                :aria-label="locale.t('pageManager.routeAria', 'Route for {name}', { name: page.name })"
                @blur="commitRoute(page.id)"
                @keydown.enter="handleTextKeydown"
                @keydown.esc="cancelEdit"
              />
            </template>
            <ElButton
              v-else
              link
              type="primary"
              class="page-manager__link"
              :title="locale.t('pageManager.openAria', 'Open {name} in the designer', { name: page.name })"
              :aria-label="locale.t('pageManager.openAria', 'Open {name} in the designer', { name: page.name })"
              :disabled="busy"
              @click="emit('openPage', page.id)"
            >
              <span class="page-manager__link-label">{{ page.name }}</span>
              <ArrowUpRight :size="13" aria-hidden="true" />
            </ElButton>
            <div class="page-manager__meta">
              <span class="page-manager__kind"><Files :size="12" aria-hidden="true" />{{ surfaceKindLabel(page.kind) }}</span>
              <code v-if="page.kind === 'page'">{{ page.route }}</code>
            </div>
          </div>
        </div>
        <footer class="page-manager__actions">
          <ElButton
            v-if="editingId !== page.id"
            native-type="button"
            text
            circle
            :title="locale.t('pageManager.edit', 'Edit page')"
            :aria-label="locale.t('pageManager.editAria', 'Edit {name}', { name: page.name })"
            :disabled="busy"
            @click="beginEdit(page.id)"
          >
            <Pencil :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton
            v-else
            native-type="button"
            text
            circle
            :title="locale.t('pageManager.finish', 'Done')"
            :aria-label="locale.t('pageManager.finishAria', 'Finish editing {name}', { name: page.name })"
            :disabled="busy"
            @click="finishEdit()"
          >
            <Check :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton
            native-type="button"
            text
            circle
            :class="{ 'is-home': project.homeSurfaceId === page.id }"
            :title="project.homeSurfaceId === page.id ? locale.t('pageManager.home', 'Home page') : locale.t('pageManager.setHome', 'Set as home page')"
            :aria-label="project.homeSurfaceId === page.id ? locale.t('pageManager.homeAria', '{name} is the home page', { name: page.name }) : locale.t('pageManager.setHomeAria', 'Set {name} as home page', { name: page.name })"
            :aria-pressed="project.homeSurfaceId === page.id"
            :disabled="busy || page.kind !== 'page' || project.homeSurfaceId === page.id"
            @click="emit('action', { type: 'surface.home', surfaceId: page.id })"
          >
            <Home :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton native-type="button" text circle :title="locale.t('pageManager.duplicate', 'Duplicate page')" :aria-label="locale.t('pageManager.duplicateAria', 'Duplicate {name}', { name: page.name })" :disabled="busy" @click="emit('action', { type: 'surface.duplicate', surfaceId: page.id })">
            <Copy :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton native-type="button" text circle :title="locale.t('pageManager.export', 'Export page')" :aria-label="locale.t('pageManager.exportAria', 'Export {name}', { name: page.name })" :disabled="busy" @click="exportPage(page.id)">
            <Download :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton native-type="button" text circle :title="locale.t('pageManager.exportSource', 'Export page source')" :aria-label="locale.t('pageManager.exportSourceAria', 'Export source for {name}', { name: page.name })" :disabled="busy" @click="exportPageSource(page.id)">
            <Code2 :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton v-if="page.kind !== 'page'" native-type="button" text circle :title="locale.t('surface.presentation', 'Overlay appearance')" :aria-label="locale.t('surface.presentationFor', 'Edit presentation for {name}', { name: page.name })" :aria-expanded="editingPresentationId === page.id" :disabled="busy" @click="editingPresentationId = editingPresentationId === page.id ? undefined : page.id">
            <SlidersHorizontal :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton native-type="button" text circle type="danger" class="is-danger" :title="locale.t('pageManager.delete', 'Delete page')" :aria-label="locale.t('pageManager.deleteAria', 'Delete {name}', { name: page.name })" :disabled="busy || project.surfaceOrder.length === 1" @click="pendingDeleteId = page.id">
            <Trash2 :size="15" aria-hidden="true" />
          </ElButton>
          <ElDropdown trigger="click" placement="bottom-end" append-to="#workbench-overlays" @command="(command: string) => command === 'template' ? emit('saveTemplate', page.id) : moveSurface(page.id, command === 'up' ? -1 : 1)">
            <ElButton native-type="button" text circle :disabled="busy" :aria-label="locale.t('pageManager.more', 'More page actions')" :title="locale.t('pageManager.more', 'More page actions')">
              <MoreHorizontal :size="16" aria-hidden="true" />
            </ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem command="template" :disabled="busy">
                  <LibraryBig :size="15" aria-hidden="true" />{{ locale.t('pages.saveTemplate', 'Save as template') }}
                </ElDropdownItem>
                <ElDropdownItem command="up" :disabled="busy || project.surfaceOrder[0] === page.id">
                  <ArrowUp :size="15" aria-hidden="true" />{{ locale.t('pageManager.moveUp', 'Move page up') }}
                </ElDropdownItem>
                <ElDropdownItem command="down" :disabled="busy || project.surfaceOrder.at(-1) === page.id">
                  <ArrowDown :size="15" aria-hidden="true" />{{ locale.t('pageManager.moveDown', 'Move page down') }}
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </footer>
        <SurfacePresentationEditor
          v-if="page.kind !== 'page' && editingPresentationId === page.id"
          :surface="page"
          :disabled="busy"
          :locale="props.locale"
          @cancel="editingPresentationId = undefined"
          @save="emit('action', { type: 'surface.presentation', surfaceId: page.id, presentation: $event }); editingPresentationId = undefined"
        />
      </article>
      <div v-if="filteredSurfaces.length === 0" class="page-manager__empty">
        <Files :size="30" aria-hidden="true" />
        <strong>{{ search ? locale.t('pageManager.noMatch', 'No pages match this search.') : locale.t('pageManager.empty', 'No pages yet') }}</strong>
        <ElButton v-if="!search" native-type="button" :disabled="busy" @click="emit('createSurface')">
          <FilePlus2 :size="15" aria-hidden="true" />{{ locale.t('pages.new', 'New page') }}
        </ElButton>
      </div>
    </div>

    <ElAlert
      v-if="pendingDeleteSurface"
      class="page-manager__confirm"
      type="error"
      :closable="false"
      show-icon
      role="alert"
      aria-labelledby="delete-page-title"
    >
      <template #title>
        <strong id="delete-page-title">{{ locale.t('pageManager.deletePrompt', 'Delete {name}?', { name: pendingDeleteSurface.name }) }}</strong>
      </template>
      <div class="page-manager__confirm-content">
        <span>{{ locale.t('pageManager.deleteDescription', 'This page and its design model will be removed from the project.') }}</span>
        <div>
          <ElButton native-type="button" size="small" @click="pendingDeleteId = undefined">
            {{ locale.t('pageManager.cancel', 'Cancel') }}
          </ElButton>
          <ElButton native-type="button" size="small" type="danger" class="is-danger" @click="confirmDelete">
            {{ locale.t('pageManager.delete', 'Delete page') }}
          </ElButton>
        </div>
      </div>
    </ElAlert>
  </section>
</template>

<style src="./style/index.css" scoped />
