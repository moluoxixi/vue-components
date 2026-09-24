<script setup lang="ts">
import type { SurfaceManagerEmits, SurfaceManagerProps } from './types'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  FilePlus2,
  Home,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, watch } from 'vue'
import { SurfacePresentationEditor } from './components'

const props = defineProps<SurfaceManagerProps>()

const emit = defineEmits<SurfaceManagerEmits>()

const search = ref('')
const names = ref<Record<string, string>>({})
const routes = ref<Record<string, string>>({})
const pendingDeleteId = ref<string>()
const editingPresentationId = ref<string>()
const editingId = ref<string>()
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

function selectProject(id: string): void {
  if (id !== props.project.id)
    emit('openProject', id)
}

function confirmDelete(): void {
  if (!pendingDeleteId.value)
    return
  emit('action', { type: 'surface.remove', surfaceId: pendingDeleteId.value })
  pendingDeleteId.value = undefined
}
</script>

<template>
  <section class="page-manager" aria-labelledby="page-manager-title">
    <header class="page-manager__header">
      <div>
        <nav class="page-manager__breadcrumb" :aria-label="locale.t('pageManager.breadcrumb', 'Breadcrumb')">
          <ElButton link type="primary" class="page-manager__breadcrumb-link" @click="emit('openProjects')">
            {{ locale.t('pageManager.projects', 'Projects') }}
          </ElButton>
          <span aria-hidden="true">/</span>
          <span class="page-manager__breadcrumb-current">{{ project.name }}</span>
        </nav>
        <h2 id="page-manager-title">{{ locale.t('pageManager.title', 'Page management') }}</h2>
      </div>
      <ElButton native-type="button" text circle :title="locale.t('pageManager.back', 'Back to designer')" :aria-label="locale.t('pageManager.back', 'Back to designer')" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </ElButton>
    </header>

    <div class="page-manager__toolbar">
      <label>
        <span>{{ locale.t('pageManager.project', 'Project') }}</span>
        <ElSelect :model-value="project.id" :disabled="busy" :aria-label="locale.t('pageManager.project', 'Project')" append-to="#workbench-overlays" @change="selectProject">
          <ElOption v-for="item in projects" :key="item.id" :value="item.id" :label="`${item.name} · ${locale.t('pageManager.pageCount', '{count} pages', { count: item.surfaceCount })}`" />
        </ElSelect>
      </label>
      <label class="page-manager__search">
        <span class="sr-only">{{ locale.t('pageManager.search', 'Search pages') }}</span>
        <ElInput v-model="search" type="search" clearable :placeholder="locale.t('pageManager.search', 'Search pages')" :aria-label="locale.t('pageManager.search', 'Search pages')">
          <template #prefix>
            <Search :size="15" aria-hidden="true" />
          </template>
        </ElInput>
      </label>
      <div class="page-manager__create-actions">
        <ElButton data-create-trigger="page-manager-new-surface" native-type="button" type="primary" :disabled="busy" @click="emit('createSurface')">
          <FilePlus2 :size="16" aria-hidden="true" />
          {{ locale.t('pages.new', 'New page') }}
        </ElButton>
      </div>
    </div>

    <div class="page-manager__table" role="table" :aria-label="locale.t('pageManager.projectSurfaces', 'Project pages')">
      <div class="page-manager__table-header" role="row">
        <span role="columnheader">{{ locale.t('pageManager.page', 'Surface') }}</span>
        <span role="columnheader">{{ locale.t('pageManager.actions', 'Actions') }}</span>
      </div>
      <div
        v-for="page in filteredSurfaces"
        :key="page.id"
        class="page-manager__row"
        role="row"
        @keydown.esc="cancelEdit"
      >
        <div class="page-manager__name-cell" role="cell">
          <span class="sr-only">{{ locale.t('pageManager.pageName', 'Surface name') }}</span>
          <template v-if="editingId === page.id">
            <ElInput
              v-model="names[page.id]"
              size="small"
              autofocus
              :disabled="busy"
              :aria-label="locale.t('pageManager.pageNameAria', 'Surface name for {name}', { name: page.name })"
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
          <small>{{ page.id }} · {{ page.kind }}{{ page.kind === 'page' ? ` · ${page.route}` : '' }}</small>
        </div>
        <div class="page-manager__actions" role="cell">
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
          <ElButton native-type="button" text circle :title="locale.t('pageManager.moveUp', 'Move page up')" :aria-label="locale.t('pageManager.moveUpAria', 'Move {name} up', { name: page.name })" :disabled="busy || project.surfaceOrder[0] === page.id" @click="moveSurface(page.id, -1)">
            <ArrowUp :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton native-type="button" text circle :title="locale.t('pageManager.moveDown', 'Move page down')" :aria-label="locale.t('pageManager.moveDownAria', 'Move {name} down', { name: page.name })" :disabled="busy || project.surfaceOrder.at(-1) === page.id" @click="moveSurface(page.id, 1)">
            <ArrowDown :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton native-type="button" text circle :title="locale.t('pageManager.duplicate', 'Duplicate surface')" :aria-label="locale.t('pageManager.duplicateAria', 'Duplicate {name}', { name: page.name })" :disabled="busy" @click="emit('action', { type: 'surface.duplicate', surfaceId: page.id })">
            <Copy :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton v-if="page.kind !== 'page'" native-type="button" text circle :title="locale.t('surface.presentation', 'Surface presentation')" :aria-label="locale.t('surface.presentationFor', 'Edit presentation for {name}', { name: page.name })" :aria-expanded="editingPresentationId === page.id" :disabled="busy" @click="editingPresentationId = editingPresentationId === page.id ? undefined : page.id">
            <SlidersHorizontal :size="15" aria-hidden="true" />
          </ElButton>
          <ElButton native-type="button" text circle type="danger" class="is-danger" :title="locale.t('pageManager.delete', 'Delete page')" :aria-label="locale.t('pageManager.deleteAria', 'Delete {name}', { name: page.name })" :disabled="busy || project.surfaceOrder.length === 1" @click="pendingDeleteId = page.id">
            <Trash2 :size="15" aria-hidden="true" />
          </ElButton>
        </div>
        <SurfacePresentationEditor
          v-if="page.kind !== 'page' && editingPresentationId === page.id"
          :surface="page"
          :disabled="busy"
          :locale="props.locale"
          @cancel="editingPresentationId = undefined"
          @save="emit('action', { type: 'surface.presentation', surfaceId: page.id, presentation: $event }); editingPresentationId = undefined"
        />
      </div>
      <p v-if="filteredSurfaces.length === 0" class="page-manager__empty">{{ locale.t('pageManager.noMatch', 'No pages match this search.') }}</p>
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
          <ElButton native-type="button" size="small" @click="pendingDeleteId = undefined">{{ locale.t('pageManager.cancel', 'Cancel') }}</ElButton>
          <ElButton native-type="button" size="small" type="danger" class="is-danger" @click="confirmDelete">{{ locale.t('pageManager.delete', 'Delete page') }}</ElButton>
        </div>
      </div>
    </ElAlert>
  </section>
</template>

<style scoped>
.page-manager {
  display: grid;
  width: 100%;
  min-height: 0;
  max-height: none;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  color: var(--wb-text);
  background: transparent;
}

.page-manager__header,
.page-manager__toolbar,
.page-manager__table-header,
.page-manager__row {
  display: grid;
  align-items: center;
}

.page-manager__header {
  min-height: 64px;
  padding: 10px 14px 10px 18px;
  grid-template-columns: minmax(0, 1fr) auto;
  border-bottom: 1px solid var(--wb-separator);
}

.page-manager__header span,
.page-manager__row small {
  color: var(--wb-muted);
  font-size: 11px;
}

.page-manager__breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-manager__breadcrumb-link.el-button {
  height: auto;
  padding: 0;
  color: var(--wb-accent);
  font-size: 11px;
}

.page-manager__breadcrumb-link.el-button:hover {
  text-decoration: underline;
}

.page-manager__breadcrumb-current {
  color: var(--wb-muted);
  font-size: 11px;
}

.page-manager__header h2 {
  margin: 2px 0 0;
  color: var(--wb-text-strong);
  font-size: 18px;
  letter-spacing: 0;
}

.page-manager__header > .el-button,
.page-manager__actions .el-button {
  margin-left: 0;
}

.page-manager__toolbar {
  padding: 10px 14px;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto;
  gap: 10px;
  border-bottom: 1px solid var(--wb-separator);
  background: var(--wb-surface);
}

.page-manager__toolbar label > span:not(.sr-only) {
  display: block;
  margin-bottom: 4px;
  color: var(--wb-muted);
  font-size: 11px;
}

.page-manager__search {
  position: relative;
  align-self: end;
}

.page-manager__create-actions {
  display: flex;
  align-self: end;
  gap: 8px;
}

.page-manager__create-actions .el-button {
  min-height: 32px;
  margin-left: 0;
  white-space: nowrap;
}

.page-manager__table {
  min-height: 0;
  overflow: auto;
}

.page-manager__table-header,
.page-manager__row {
  grid-template-columns: minmax(220px, 1fr) minmax(190px, auto);
  column-gap: 12px;
}

.page-manager__table-header {
  position: sticky;
  z-index: 1;
  top: 0;
  min-height: 34px;
  padding: 0 16px;
  color: var(--wb-muted);
  border-bottom: 1px solid var(--wb-separator);
  background: var(--wb-elevated);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.page-manager__row {
  min-height: 58px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--wb-separator);
}

.page-manager__row label {
  min-width: 0;
}

.page-manager__row > [role="cell"] {
  min-width: 0;
}

.page-manager__name-cell .page-manager__link.el-button {
  font-size: 13px;
  font-weight: 600;
}

.page-manager__route-input {
  margin-top: 4px;
}

/* The page name is the page's online address, so it reads as a link rather than
   as an always-editable field. Element Plus supplies the link button base; these
   rules add the Workbench palette color, the underline, and the inline metrics.
   Element Plus wraps slot content in one span, so the label row lives there. */
.page-manager__link.el-button {
  height: auto;
  padding: 0;
  color: var(--wb-accent);
  font-size: 12px;
}

.page-manager__link.el-button > span {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.page-manager__link-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-manager__link.el-button:hover:not(.is-disabled) {
  text-decoration: underline;
}

.page-manager__link.el-button.is-disabled {
  color: var(--wb-muted);
}

.page-manager__row small {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-manager__actions {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
}

.page-manager .el-button.is-home {
  color: var(--wb-accent);
  border-color: var(--wb-accent);
  background: var(--wb-accent-soft);
  opacity: 1;
}

.page-manager .el-button.is-danger {
  color: var(--wb-danger);
}

.page-manager__empty {
  margin: 0;
  padding: 36px 18px;
  color: var(--wb-muted);
  text-align: center;
}

.page-manager__confirm {
  min-height: 72px;
  border-radius: 0;
  border-top: 1px solid var(--wb-danger);
}

.page-manager__confirm-content {
  display: grid;
  gap: 3px;
}

.page-manager__confirm-content > span {
  color: var(--wb-muted);
  font-size: 12px;
}

.page-manager__confirm-content > div {
  display: flex;
  margin-top: 6px;
  gap: 8px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 680px) {
  .page-manager {
    width: 100%;
    max-height: none;
  }

  .page-manager__toolbar {
    grid-template-columns: 1fr auto;
  }

  .page-manager__toolbar > label:first-child {
    grid-column: 1 / -1;
  }

  .page-manager__table-header {
    display: none;
  }

  .page-manager__row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .page-manager__actions {
    justify-content: flex-start;
  }

}
</style>
