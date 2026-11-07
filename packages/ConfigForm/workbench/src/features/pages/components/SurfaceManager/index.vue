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
import BrowseViewToggle from '../../../../components/BrowseViewToggle.vue'
import { useBrowseView } from '../../../../components/composables/use-browse-view'
import WorkbenchCommandHint from '../../../../components/WorkbenchCommandHint/index.vue'
import { createPagePreviewDataUrl } from '../../services'
import { SurfacePresentationEditor } from './components'

const props = defineProps<SurfaceManagerProps>()

const emit = defineEmits<SurfaceManagerEmits>()

const search = ref('')
const browseView = useBrowseView('pages')
const names = ref<Record<string, string>>({})
const routes = ref<Record<string, string>>({})
const pendingDeleteId = ref<string>()
const editingPresentationId = ref<string>()
const editingId = ref<string>()
const nameInputRefs = new Map<string, { focus?: () => void }>()
const locale = computed(() => createDesignerLocale(props.locale))
const busyReason = computed(() => props.busy ? locale.value.t('pageManager.busyReason', 'A project operation is in progress. Try again when it finishes.') : undefined)

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
  return createPagePreviewDataUrl(page, { emptyLabel: locale.value.t('pageManager.blankPreview', 'Blank page') })
}

function exportPage(surfaceId: string): void {
  emit('export', surfaceId)
}

function exportPageSource(surfaceId: string): void {
  emit('exportSource', surfaceId)
}

function runPageAction(command: string, surfaceId: string): void {
  switch (command) {
    case 'home':
      emit('action', { type: 'surface.home', surfaceId })
      break
    case 'duplicate':
      emit('action', { type: 'surface.duplicate', surfaceId })
      break
    case 'export':
      exportPage(surfaceId)
      break
    case 'source':
      exportPageSource(surfaceId)
      break
    case 'delete':
      pendingDeleteId.value = surfaceId
      break
    case 'presentation':
      editingPresentationId.value = editingPresentationId.value === surfaceId ? undefined : surfaceId
      break
    case 'template':
      emit('saveTemplate', surfaceId)
      break
    case 'up':
      moveSurface(surfaceId, -1)
      break
    case 'down':
      moveSurface(surfaceId, 1)
      break
  }
}

function pageActions(page: typeof surfaces.value[number]) {
  const t = locale.value.t
  const unavailable = (reason?: string) => busyReason.value || reason
  return [
    ...(page.kind === 'page' ? [{ command: 'home', icon: Home, label: t('pageManager.setHome', 'Set as home page'), reason: unavailable(props.project.homeSurfaceId === page.id ? t('pageManager.alreadyHome', 'This is already the home page.') : undefined) }] : []),
    { command: 'duplicate', icon: Copy, label: t('pageManager.duplicate', 'Duplicate page'), reason: unavailable() },
    { command: 'export', icon: Download, label: t('pageManager.export', 'Export page'), reason: unavailable() },
    { command: 'source', icon: Code2, label: t('pageManager.exportSource', 'Export page source'), reason: unavailable() },
    ...(page.kind !== 'page' ? [{ command: 'presentation', icon: SlidersHorizontal, label: t('surface.presentation', 'Overlay appearance'), reason: unavailable() }] : []),
    { command: 'template', icon: LibraryBig, label: t('pages.saveTemplate', 'Save as template'), reason: unavailable() },
    { command: 'up', icon: ArrowUp, label: t('pageManager.moveUp', 'Move page up'), reason: unavailable(props.project.surfaceOrder[0] === page.id ? t('pageManager.firstPage', 'This is the first page; move it down before moving it up.') : undefined) },
    { command: 'down', icon: ArrowDown, label: t('pageManager.moveDown', 'Move page down'), reason: unavailable(props.project.surfaceOrder.at(-1) === page.id ? t('pageManager.lastPage', 'This is the last page; add another page or move this one up first.') : undefined) },
    { command: 'delete', icon: Trash2, label: t('pageManager.delete', 'Delete page'), reason: unavailable(props.project.surfaceOrder.length === 1 ? t('pageManager.onlyPage', 'Keep at least one page in the project. Create another page before deleting this one.') : undefined), divided: true },
  ]
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
        <h1 class="page-manager__project-name" :title="props.project.name">
          {{ props.project.name }}
        </h1>
        <div class="page-manager__header-summary" :aria-label="locale.t('pageManager.summary', 'Page summary')">
          <span>{{ surfaceKindLabel('page') }}<strong>{{ pageStats.pages }}</strong></span>
          <span>{{ surfaceKindLabel('dialog') }}<strong>{{ pageStats.dialogs }}</strong></span>
          <span>{{ surfaceKindLabel('drawer') }}<strong>{{ pageStats.drawers }}</strong></span>
        </div>
      </header>
    </slot>

    <div class="page-manager__toolbar grid min-w-0 items-center p-4 gap-3">
      <h2 class="page-manager__list-title">
        {{ locale.t('pageManager.projectSurfaces', 'Project pages') }}
        <span>{{ pageStats.total }}</span>
      </h2>
      <label class="page-manager__search">
        <span class="sr-only">{{ locale.t('pageManager.search', 'Search pages') }}</span>
        <ElInput v-model="search" type="search" clearable :placeholder="locale.t('pageManager.search', 'Search pages')" :aria-label="locale.t('pageManager.search', 'Search pages')">
          <template #prefix><Search :size="15" aria-hidden="true" /></template>
        </ElInput>
      </label>
      <div class="page-manager__create-actions">
        <WorkbenchCommandHint detached :label="locale.t('pages.import', 'Import page')" :disabled-reason="busyReason">
          <ElButton data-create-trigger="page-manager-import-surface" native-type="button" :disabled="props.busy" :aria-label="locale.t('pages.import', 'Import page')" @click="emit('importSurface')">
            <FileJson2 :size="16" aria-hidden="true" /><span class="page-manager__secondary-label">{{ locale.t('pages.import', 'Import page') }}</span>
          </ElButton>
        </WorkbenchCommandHint>
        <WorkbenchCommandHint detached :label="locale.t('pages.fromTemplate', 'From template')" :disabled-reason="busyReason">
          <ElButton data-create-trigger="page-manager-template" native-type="button" :disabled="props.busy" :aria-label="locale.t('pages.fromTemplate', 'From template')" @click="emit('useTemplate')">
            <LibraryBig :size="16" aria-hidden="true" /><span class="page-manager__secondary-label">{{ locale.t('pages.fromTemplate', 'From template') }}</span>
          </ElButton>
        </WorkbenchCommandHint>
      </div>
      <BrowseViewToggle v-model="browseView" :locale="props.locale" />
      <div class="page-manager__new-group" role="group" :aria-label="locale.t('pages.new', 'New page')">
        <WorkbenchCommandHint detached :label="locale.t('pages.new', 'New page')" :disabled-reason="busyReason">
          <ElButton data-create-trigger="page-manager-new-surface" native-type="button" type="primary" :disabled="props.busy" @click="emit('createSurface', 'page')">
            <FilePlus2 :size="16" aria-hidden="true" />{{ locale.t('pages.new', 'New page') }}
          </ElButton>
        </WorkbenchCommandHint>
        <WorkbenchCommandHint detached :label="locale.t('pages.newType', 'Choose page type')" :disabled-reason="busyReason">
          <ElDropdown trigger="click" placement="bottom-end" :persistent="false" append-to="#workbench-overlays" @command="emit('createSurface', $event)">
            <ElButton type="primary" :disabled="props.busy" :aria-label="locale.t('pages.newType', 'Choose page type')">
              <ChevronDown :size="15" aria-hidden="true" />
            </ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem v-for="kind in (['page', 'dialog', 'drawer'] as const)" :key="kind" :command="kind" :disabled="props.busy">
                  <WorkbenchCommandHint :label="kind === 'page' ? locale.t('pages.new', 'New page') : kind === 'dialog' ? locale.t('pages.newDialog', 'New dialog') : locale.t('pages.newDrawer', 'New drawer')" :disabled-reason="busyReason">
                    <span class="menu-command-content">{{ kind === 'page' ? locale.t('pages.new', 'New page') : kind === 'dialog' ? locale.t('pages.newDialog', 'New dialog') : locale.t('pages.newDrawer', 'New drawer') }}</span>
                  </WorkbenchCommandHint>
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </WorkbenchCommandHint>
      </div>
    </div>

    <div class="page-manager__table" :data-view="browseView" role="list" tabindex="0" :aria-label="locale.t('pageManager.projectSurfaces', 'Project pages')">
      <article
        v-for="page in filteredSurfaces"
        :key="page.id"
        class="page-manager__row"
        role="listitem"
        @keydown.esc="cancelEdit"
      >
        <div class="page-manager__preview-frame">
          <img class="page-manager__preview" :src="previewImage(page)" alt="">
          <span class="page-manager__preview-kind" :data-kind="page.kind">{{ surfaceKindLabel(page.kind) }}</span>
          <span v-if="props.project.homeSurfaceId === page.id" class="page-manager__preview-home"><Home :size="12" aria-hidden="true" />{{ locale.t('pageManager.home', 'Home page') }}</span>
        </div>
        <div class="page-manager__name-cell">
          <div class="page-manager__name-content">
            <span class="sr-only">{{ locale.t('pageManager.pageName', 'Page name') }}</span>
            <template v-if="editingId === page.id">
              <WorkbenchCommandHint detached anchor-class="page-manager__field-hint" :label="locale.t('pageManager.pageName', 'Page name')" :disabled-reason="busyReason">
                <ElInput
                  :ref="(instance: unknown) => setNameInputRef(page.id, instance)"
                  v-model="names[page.id]"
                  size="small"
                  :disabled="props.busy"
                  :aria-label="locale.t('pageManager.pageNameAria', 'Page name for {name}', { name: page.name })"
                  @blur="commitName(page.id)"
                  @keydown.enter="handleTextKeydown"
                  @keydown.esc="cancelEdit"
                />
              </WorkbenchCommandHint>
              <WorkbenchCommandHint v-if="page.kind === 'page'" detached anchor-class="page-manager__field-hint" :label="locale.t('pageManager.routeAria', 'Route for {name}', { name: page.name })" :disabled-reason="busyReason">
                <ElInput
                  v-model="routes[page.id]"
                  class="page-manager__route-input"
                  size="small"
                  :disabled="props.busy"
                  :aria-label="locale.t('pageManager.routeAria', 'Route for {name}', { name: page.name })"
                  @blur="commitRoute(page.id)"
                  @keydown.enter="handleTextKeydown"
                  @keydown.esc="cancelEdit"
                />
              </WorkbenchCommandHint>
            </template>
            <WorkbenchCommandHint v-else detached anchor-class="page-manager__title-hint" :label="locale.t('pageManager.openAria', 'Open {name} in the designer', { name: page.name })" :disabled-reason="busyReason">
              <ElButton
                link
                type="primary"
                class="page-manager__link"
                :aria-label="locale.t('pageManager.openAria', 'Open {name} in the designer', { name: page.name })"
                :disabled="props.busy"
                @click="emit('openPage', page.id)"
              >
                <span class="page-manager__link-label">{{ page.name }}</span>
              </ElButton>
            </WorkbenchCommandHint>
            <div class="page-manager__meta">
              <span v-if="props.project.homeSurfaceId === page.id" class="page-manager__home-marker"><Home :size="12" aria-hidden="true" />{{ locale.t('pageManager.home', 'Home page') }}</span><span class="page-manager__kind"><Files :size="12" aria-hidden="true" />{{ surfaceKindLabel(page.kind) }}</span>
              <code v-if="page.kind === 'page'" :title="page.route">{{ page.route }}</code>
            </div>
          </div>
        </div>
        <footer class="page-manager__actions">
          <WorkbenchCommandHint v-if="editingId !== page.id" detached :label="locale.t('pageManager.editDetails', 'Edit name and route')" :disabled-reason="busyReason">
            <ElButton native-type="button" text :aria-label="locale.t('pageManager.editAria', 'Edit {name}', { name: page.name })" :disabled="props.busy" @click="beginEdit(page.id)">
              <Pencil :size="15" aria-hidden="true" />
            </ElButton>
          </WorkbenchCommandHint>
          <WorkbenchCommandHint v-else detached :label="locale.t('pageManager.finish', 'Done')" :disabled-reason="busyReason">
            <ElButton native-type="button" text :aria-label="locale.t('pageManager.finishAria', 'Finish editing {name}', { name: page.name })" :disabled="props.busy" @click="finishEdit()">
              <Check :size="15" aria-hidden="true" />
            </ElButton>
          </WorkbenchCommandHint>
          <WorkbenchCommandHint detached :label="locale.t('pageManager.more', 'More page actions')" :disabled-reason="busyReason">
            <ElDropdown trigger="click" placement="bottom-end" :persistent="false" append-to="#workbench-overlays" @command="(command: string) => runPageAction(command, page.id)">
              <ElButton native-type="button" text :disabled="props.busy" :aria-label="locale.t('pageManager.more', 'More page actions')">
                <MoreHorizontal :size="16" aria-hidden="true" />
              </ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem v-for="action in pageActions(page)" :key="action.command" :command="action.command" :divided="action.divided" :disabled="!!action.reason">
                    <WorkbenchCommandHint :label="action.label" :disabled-reason="action.reason">
                      <span class="menu-command-content"><component :is="action.icon" :size="15" aria-hidden="true" />{{ action.label }}</span>
                    </WorkbenchCommandHint>
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </WorkbenchCommandHint>
          <WorkbenchCommandHint v-if="editingId !== page.id" detached anchor-class="page-manager__design-hint" :label="locale.t('pageManager.openAria', 'Open {name} in the designer', { name: page.name })" :disabled-reason="busyReason">
            <ElButton class="page-manager__design" native-type="button" :disabled="props.busy" @click="emit('openPage', page.id)">
              {{ locale.t('pageManager.design', 'Open design') }}<ArrowUpRight :size="15" aria-hidden="true" />
            </ElButton>
          </WorkbenchCommandHint>
        </footer>
        <SurfacePresentationEditor
          v-if="page.kind !== 'page' && editingPresentationId === page.id"
          :surface="page"
          :disabled="props.busy"
          :locale="props.locale"
          @cancel="editingPresentationId = undefined"
          @save="emit('action', { type: 'surface.presentation', surfaceId: page.id, presentation: $event }); editingPresentationId = undefined"
        />
      </article>
      <div v-if="filteredSurfaces.length === 0" class="page-manager__empty">
        <Files :size="30" aria-hidden="true" />
        <strong>{{ search ? locale.t('pageManager.noMatch', 'No pages match this search.') : locale.t('pageManager.empty', 'No pages yet') }}</strong>
        <ElButton v-if="search" @click="search = ''">
          {{ locale.t('pageManager.clearSearch', 'Clear search') }}
        </ElButton>
        <WorkbenchCommandHint v-else detached :label="locale.t('pages.new', 'New page')" :disabled-reason="busyReason">
          <ElButton native-type="button" :disabled="props.busy" @click="emit('createSurface')">
            <FilePlus2 :size="15" aria-hidden="true" />{{ locale.t('pages.new', 'New page') }}
          </ElButton>
        </WorkbenchCommandHint>
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
