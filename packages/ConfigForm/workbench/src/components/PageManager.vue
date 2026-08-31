<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSummary, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { ProjectPageAction } from '../project'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FilePlus2,
  Home,
  Search,
  Trash2,
  X,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  project: ReadonlyProjectDocument
  projects: ProjectSummary[]
  busy?: boolean
  locale?: DesignerLocaleOptions
}>()

const emit = defineEmits<{
  close: []
  createPage: []
  openProject: [id: string]
  action: [action: ProjectPageAction]
}>()

const search = ref('')
const names = ref<Record<string, string>>({})
const routes = ref<Record<string, string>>({})
const pendingDeleteId = ref<string>()
const locale = computed(() => createDesignerLocale(props.locale))

const pages = computed(() => props.project.pageOrder.map(id => props.project.pagesById[id]!).filter(Boolean))

watch(pages, (pages) => {
  names.value = Object.fromEntries(pages.map(page => [page.id, page.name]))
  routes.value = Object.fromEntries(pages.map(page => [page.id, page.route]))
  if (pendingDeleteId.value && !pages.some(page => page.id === pendingDeleteId.value))
    pendingDeleteId.value = undefined
}, { deep: true, immediate: true })

const filteredPages = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query)
    return pages.value
  return pages.value.filter(page => `${page.name} ${page.route}`.toLocaleLowerCase().includes(query))
})

const pendingDeletePage = computed(() => pages.value.find(page => page.id === pendingDeleteId.value))

function commitName(pageId: string): void {
  const value = names.value[pageId]?.trim()
  const current = props.project.pagesById[pageId]
  if (!value || !current) {
    names.value[pageId] = current?.name ?? ''
    return
  }
  if (value !== current.name)
    emit('action', { type: 'page.rename', pageId, name: value })
}

function commitRoute(pageId: string): void {
  const value = routes.value[pageId]?.trim()
  const current = props.project.pagesById[pageId]
  if (!value || !current) {
    routes.value[pageId] = current?.route ?? ''
    return
  }
  if (value !== current.route)
    emit('action', { type: 'page.route', pageId, route: value })
}

function handleTextKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter')
    (event.currentTarget as HTMLInputElement).blur()
}

function movePage(pageId: string, offset: number): void {
  const index = props.project.pageOrder.indexOf(pageId)
  if (index >= 0)
    emit('action', { type: 'page.move', pageId, index: index + offset })
}

function selectProject(event: Event): void {
  const select = event.target as HTMLSelectElement
  const id = select.value
  if (id !== props.project.id)
    emit('openProject', id)
  void nextTick(() => select.value = props.project.id)
}

function confirmDelete(): void {
  if (!pendingDeleteId.value)
    return
  emit('action', { type: 'page.remove', pageId: pendingDeleteId.value })
  pendingDeleteId.value = undefined
}
</script>

<template>
  <section class="page-manager" role="dialog" aria-modal="true" aria-labelledby="page-manager-title">
    <header class="page-manager__header">
      <div>
        <span>{{ locale.t('pageManager.eyebrow', 'Project structure') }}</span>
        <h2 id="page-manager-title">{{ locale.t('pageManager.title', 'Pages') }}</h2>
      </div>
      <button type="button" :title="locale.t('pageManager.close', 'Close page manager')" :aria-label="locale.t('pageManager.close', 'Close page manager')" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <div class="page-manager__toolbar">
      <label>
        <span>{{ locale.t('pageManager.project', 'Project') }}</span>
        <select :value="project.id" :disabled="busy" :aria-label="locale.t('pageManager.project', 'Project')" @change="selectProject">
          <option v-for="item in projects" :key="item.id" :value="item.id">
            {{ item.name }} · {{ locale.t('pageManager.pageCount', '{count} pages', { count: item.pageCount }) }}
          </option>
        </select>
      </label>
      <label class="page-manager__search">
        <Search :size="15" aria-hidden="true" />
        <span class="sr-only">{{ locale.t('pageManager.search', 'Search pages') }}</span>
        <input v-model="search" type="search" :placeholder="locale.t('pageManager.search', 'Search pages')" :aria-label="locale.t('pageManager.search', 'Search pages')">
      </label>
      <button class="page-manager__create" type="button" :disabled="busy" @click="emit('createPage')">
        <FilePlus2 :size="16" aria-hidden="true" />
        {{ locale.t('pageManager.new', 'New page') }}
      </button>
    </div>

    <div class="page-manager__table" role="table" :aria-label="locale.t('pageManager.projectPages', 'Project pages')">
      <div class="page-manager__table-header" role="row">
        <span role="columnheader">{{ locale.t('pageManager.page', 'Page') }}</span>
        <span role="columnheader">{{ locale.t('pageManager.route', 'Route') }}</span>
        <span role="columnheader">{{ locale.t('pageManager.actions', 'Actions') }}</span>
      </div>
      <div
        v-for="page in filteredPages"
        :key="page.id"
        class="page-manager__row"
        role="row"
      >
        <label role="cell">
          <span class="sr-only">{{ locale.t('pageManager.pageName', 'Page name') }}</span>
          <input
            v-model="names[page.id]"
            :disabled="busy"
            :aria-label="locale.t('pageManager.pageNameAria', 'Page name for {name}', { name: page.name })"
            @blur="commitName(page.id)"
            @keydown="handleTextKeydown"
          >
          <small>{{ page.id }}</small>
        </label>
        <label role="cell">
          <span class="sr-only">{{ locale.t('pageManager.route', 'Page route') }}</span>
          <input
            v-model="routes[page.id]"
            :disabled="busy"
            :aria-label="locale.t('pageManager.routeAria', 'Route for {name}', { name: page.name })"
            @blur="commitRoute(page.id)"
            @keydown="handleTextKeydown"
          >
        </label>
        <div class="page-manager__actions" role="cell">
          <button
            type="button"
            :class="{ 'is-home': project.homePageId === page.id }"
            :title="project.homePageId === page.id ? locale.t('pageManager.home', 'Home page') : locale.t('pageManager.setHome', 'Set as home page')"
            :aria-label="project.homePageId === page.id ? locale.t('pageManager.homeAria', '{name} is the home page', { name: page.name }) : locale.t('pageManager.setHomeAria', 'Set {name} as home page', { name: page.name })"
            :aria-pressed="project.homePageId === page.id"
            :disabled="busy || project.homePageId === page.id"
            @click="emit('action', { type: 'page.home', pageId: page.id })"
          >
            <Home :size="15" aria-hidden="true" />
          </button>
          <button type="button" :title="locale.t('pageManager.moveUp', 'Move page up')" :aria-label="locale.t('pageManager.moveUpAria', 'Move {name} up', { name: page.name })" :disabled="busy || project.pageOrder[0] === page.id" @click="movePage(page.id, -1)">
            <ArrowUp :size="15" aria-hidden="true" />
          </button>
          <button type="button" :title="locale.t('pageManager.moveDown', 'Move page down')" :aria-label="locale.t('pageManager.moveDownAria', 'Move {name} down', { name: page.name })" :disabled="busy || project.pageOrder.at(-1) === page.id" @click="movePage(page.id, 1)">
            <ArrowDown :size="15" aria-hidden="true" />
          </button>
          <button type="button" :title="locale.t('pageManager.duplicate', 'Duplicate page')" :aria-label="locale.t('pageManager.duplicateAria', 'Duplicate {name}', { name: page.name })" :disabled="busy" @click="emit('action', { type: 'page.duplicate', pageId: page.id })">
            <Copy :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="is-danger" :title="locale.t('pageManager.delete', 'Delete page')" :aria-label="locale.t('pageManager.deleteAria', 'Delete {name}', { name: page.name })" :disabled="busy || project.pageOrder.length === 1" @click="pendingDeleteId = page.id">
            <Trash2 :size="15" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p v-if="filteredPages.length === 0" class="page-manager__empty">{{ locale.t('pageManager.noMatch', 'No pages match this search.') }}</p>
    </div>

    <footer v-if="pendingDeletePage" class="page-manager__confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-page-title">
      <div>
        <strong id="delete-page-title">{{ locale.t('pageManager.deletePrompt', 'Delete {name}?', { name: pendingDeletePage.name }) }}</strong>
        <span>{{ locale.t('pageManager.deleteDescription', 'This page and its design model will be removed from the project.') }}</span>
      </div>
      <button type="button" @click="pendingDeleteId = undefined">{{ locale.t('pageManager.cancel', 'Cancel') }}</button>
      <button type="button" class="is-danger" @click="confirmDelete">{{ locale.t('pageManager.delete', 'Delete page') }}</button>
    </footer>
  </section>
</template>

<style scoped>
.page-manager {
  display: grid;
  width: min(980px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 32px));
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  color: var(--wb-text);
  border: 1px solid var(--wb-border);
  border-radius: 7px;
  background: var(--wb-elevated);
  box-shadow: 0 24px 70px rgb(0 0 0 / 38%);
}

.page-manager__header,
.page-manager__toolbar,
.page-manager__table-header,
.page-manager__row,
.page-manager__confirm {
  display: grid;
  align-items: center;
}

.page-manager__header {
  min-height: 64px;
  padding: 10px 14px 10px 18px;
  grid-template-columns: minmax(0, 1fr) auto;
  border-bottom: 1px solid var(--wb-border);
}

.page-manager__header span,
.page-manager__row small {
  color: var(--wb-muted);
  font-size: 11px;
}

.page-manager__header h2 {
  margin: 2px 0 0;
  color: var(--wb-text-strong);
  font-size: 18px;
  letter-spacing: 0;
}

.page-manager button {
  color: var(--wb-text);
  border: 1px solid var(--wb-border);
  border-radius: 4px;
  background: var(--wb-surface);
  cursor: pointer;
}

.page-manager button:hover:not(:disabled) {
  color: var(--wb-text-strong);
  border-color: var(--wb-control-border);
  background: var(--wb-hover);
}

.page-manager button:disabled {
  cursor: default;
  opacity: 0.48;
}

.page-manager__header > button,
.page-manager__actions button {
  display: inline-grid;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
}

.page-manager__toolbar {
  padding: 10px 14px;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto;
  gap: 10px;
  border-bottom: 1px solid var(--wb-border);
  background: var(--wb-surface);
}

.page-manager__toolbar label > span:not(.sr-only) {
  display: block;
  margin-bottom: 4px;
  color: var(--wb-muted);
  font-size: 11px;
}

.page-manager input,
.page-manager select {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  color: var(--wb-text);
  border: 1px solid var(--wb-control-border);
  border-radius: 4px;
  background: var(--wb-bg);
  font: inherit;
}

.page-manager__search {
  position: relative;
  align-self: end;
}

.page-manager__search svg {
  position: absolute;
  top: 8px;
  left: 9px;
  color: var(--wb-muted);
}

.page-manager__search input {
  padding-left: 31px;
}

.page-manager__create {
  display: inline-flex;
  min-height: 32px;
  padding: 0 11px;
  align-self: end;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.page-manager__table {
  min-height: 0;
  overflow: auto;
}

.page-manager__table-header,
.page-manager__row {
  grid-template-columns: minmax(190px, 1.15fr) minmax(170px, 1fr) 190px;
  column-gap: 12px;
}

.page-manager__table-header {
  position: sticky;
  z-index: 1;
  top: 0;
  min-height: 34px;
  padding: 0 16px;
  color: var(--wb-muted);
  border-bottom: 1px solid var(--wb-border);
  background: var(--wb-elevated);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.page-manager__row {
  min-height: 58px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--wb-border);
}

.page-manager__row label {
  min-width: 0;
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

.page-manager button.is-home {
  color: var(--wb-accent);
  border-color: var(--wb-accent);
  background: var(--wb-accent-soft);
  opacity: 1;
}

.page-manager button.is-danger {
  color: var(--wb-danger);
}

.page-manager__empty {
  margin: 0;
  padding: 36px 18px;
  color: var(--wb-muted);
  text-align: center;
}

.page-manager__confirm {
  min-height: 66px;
  padding: 10px 14px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  border-top: 1px solid var(--wb-danger);
  background: var(--wb-danger-soft);
}

.page-manager__confirm div {
  display: grid;
  gap: 3px;
}

.page-manager__confirm span {
  color: var(--wb-muted);
  font-size: 12px;
}

.page-manager__confirm button {
  min-height: 32px;
  padding: 0 11px;
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
    width: 100vw;
    max-height: 100vh;
    height: 100vh;
    border: 0;
    border-radius: 0;
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

  .page-manager__confirm {
    grid-template-columns: 1fr auto;
  }

  .page-manager__confirm div {
    grid-column: 1 / -1;
  }
}
</style>
