<script setup lang="ts">
import type { ProjectSummary } from '@moluoxixi/config-form-model'
import type { DropdownInstance, UploadFile } from 'element-plus'
import type { ProjectImageInput, ProjectManagerEmits, ProjectManagerProps } from './types'
import {
  Code2,
  Copy,
  Database,
  Download,
  FileJson2,
  FolderOpen,
  Image,
  Layers3,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import BrowseViewToggle from '../../components/BrowseViewToggle.vue'
import { useBrowseView } from '../../components/composables/use-browse-view'
import ControlHint from '../../components/ControlHint.vue'

const props = defineProps<ProjectManagerProps>()
const emit = defineEmits<ProjectManagerEmits>()
const locale = computed(() => createDesignerLocale(props.controller.localeOptions.value))
const query = ref('')
const browseView = useBrowseView('projects')
const sort = ref<'updated' | 'name'>('updated')
const openingId = ref<string>()
const activeMenuId = ref<string>()
const busyReason = computed(() => props.controller.busy.value || openingId.value
  ? locale.value.t('action.busyUnavailable', 'Wait for the current operation to finish')
  : undefined)
const projectSearch = useTemplateRef<{ focus: () => void }>('projectSearch')
const projectMenus = useTemplateRef<DropdownInstance[]>('projectMenus')
const hasQuery = computed(() => query.value.trim().length > 0)
const renameOpen = ref(false)
const renameValue = ref('')
const renameTarget = ref<ProjectSummary>()
const deleteOpen = ref(false)
const deleteTarget = ref<ProjectSummary>()
const renameInput = useTemplateRef<{ focus?: () => void }>('renameInput')
const projectImageSources = ref<Record<string, string>>({})
const projectImageKeys = ref<Record<string, string>>({})
let imageSyncToken = 0

const filteredProjects = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase()
  const collator = new Intl.Collator(locale.value.locale, { numeric: true, sensitivity: 'base' })
  return props.controller.projects.value.filter(project => !normalized
    || `${project.name} ${project.registryLock.adapter} ${adapterLabel(project.registryLock.adapter)}`.toLocaleLowerCase().includes(normalized))
    .sort((a, b) => {
      if (sort.value === 'updated') {
        const difference = (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
        if (difference)
          return difference
      }
      return collator.compare(a.name, b.name)
    })
})

function clearSearch(): void {
  query.value = ''
  void nextTick(() => projectSearch.value?.focus())
}

function revokeProjectImage(projectId: string): void {
  const source = projectImageSources.value[projectId]
  if (source?.startsWith('blob:'))
    URL.revokeObjectURL(source)
  delete projectImageSources.value[projectId]
  delete projectImageKeys.value[projectId]
}

async function syncProjectImages(projects: readonly ProjectSummary[]): Promise<void> {
  const token = ++imageSyncToken
  const activeIds = new Set(projects.map(project => project.id))
  for (const projectId of Object.keys(projectImageSources.value)) {
    if (!activeIds.has(projectId))
      revokeProjectImage(projectId)
  }
  await Promise.all(projects.map(async (project) => {
    const image = project.projectImage
    if (!image) {
      revokeProjectImage(project.id)
      return
    }
    const key = image.kind === 'embedded'
      ? `${image.id}:${image.contentHash}`
      : `${image.id}:${image.url}`
    if (projectImageKeys.value[project.id] === key)
      return
    revokeProjectImage(project.id)
    projectImageKeys.value[project.id] = key
    if (image.kind === 'url') {
      projectImageSources.value[project.id] = image.url
      return
    }
    const bytes = await props.controller.readEmbeddedResource({
      projectId: project.id,
      resourceId: image.id,
      contentHash: image.contentHash,
    })
    if (!bytes)
      return
    const source = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: image.mediaType }))
    if (token !== imageSyncToken || projectImageKeys.value[project.id] !== key)
      URL.revokeObjectURL(source)
    else
      projectImageSources.value[project.id] = source
  }))
}

watch(() => props.controller.projects.value, (projects) => {
  void syncProjectImages(projects)
}, { immediate: true })

onBeforeUnmount(() => {
  imageSyncToken += 1
  for (const projectId of Object.keys(projectImageSources.value))
    revokeProjectImage(projectId)
})

function projectImageSource(project: ProjectSummary): string | undefined {
  return projectImageSources.value[project.id]
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(locale.value.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function adapterLabel(adapter: string): string {
  if (adapter === 'element-plus')
    return 'Element Plus'
  if (adapter === 'antd-vue')
    return 'Ant Design Vue'
  return adapter
}

async function openProject(project: ProjectSummary): Promise<void> {
  if (props.controller.busy.value || openingId.value)
    return
  openingId.value = project.id
  try {
    await props.controller.requestOpenProject(project.id)
    if (props.controller.currentProject.value?.id === project.id)
      emit('open')
  }
  finally {
    openingId.value = undefined
  }
}

function showRename(project: ProjectSummary): void {
  renameTarget.value = project
  renameValue.value = project.name
  renameOpen.value = true
  void nextTick(() => renameInput.value?.focus?.())
}

async function confirmRename(): Promise<void> {
  const project = renameTarget.value
  if (!project || busyReason.value || !renameValue.value.trim())
    return
  if (await props.controller.renameProject(project.id, renameValue.value))
    renameOpen.value = false
}

function showDelete(project: ProjectSummary): void {
  deleteTarget.value = project
  deleteOpen.value = true
}

async function confirmDelete(): Promise<void> {
  const project = deleteTarget.value
  if (!project || busyReason.value)
    return
  if (await props.controller.deleteProject(project.id)) {
    deleteOpen.value = false
    deleteTarget.value = undefined
  }
}

async function runAction(command: string, project: ProjectSummary): Promise<void> {
  if (busyReason.value)
    return
  if (command === 'rename') {
    showRename(project)
    return
  }
  if (command === 'duplicate') {
    if (await props.controller.duplicateProject(project.id))
      emit('open')
    return
  }
  if (command === 'export') {
    await props.controller.exportProject(project.id)
    return
  }
  if (command === 'export-source') {
    await props.controller.exportProjectSource(project.id)
    return
  }
  if (command === 'remove-image') {
    await props.controller.removeProjectImage(project.id)
    return
  }
  if (command === 'delete')
    showDelete(project)
}

function setMenuVisible(projectId: string, visible: boolean): void {
  if (visible)
    activeMenuId.value = projectId
  else if (activeMenuId.value === projectId)
    activeMenuId.value = undefined
}

function closeProjectMenus(): void {
  projectMenus.value?.forEach(menu => menu.handleClose())
}

async function uploadProjectImage(project: ProjectSummary, uploadFile: UploadFile): Promise<void> {
  const file = uploadFile.raw
  if (!file || busyReason.value)
    return
  const mediaType = file.type.toLocaleLowerCase().startsWith('image/')
    ? file.type
    : ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' } as Record<string, string>)[file.name.split('.').at(-1)?.toLocaleLowerCase() ?? '']
  if (!mediaType)
    return
  await props.controller.setProjectImage(project.id, {
    name: file.name,
    fileName: file.name,
    mediaType,
    bytes: new Uint8Array(await file.arrayBuffer()),
  } satisfies ProjectImageInput)
}
</script>

<template>
  <main class="project-manager" :data-theme="props.ui.resolvedTheme.value" :data-palette="props.ui.paletteFamily.value">
    <header class="project-manager__topbar">
      <div class="project-manager__topbar-context">
        <h1>{{ locale.t('projects.title', 'Projects') }}</h1>
      </div>
      <div class="project-manager__commands">
        <ElButton v-if="props.controller.projects.value.length > 0" native-type="button" class="project-manager__import" data-create-trigger="project-manager-import" @click="emit('create', 'json')">
          <FileJson2 :size="16" aria-hidden="true" />
          {{ locale.t('projects.import', 'Import JSON') }}
        </ElButton>
        <ElButton native-type="button" data-project-create data-create-trigger="project-manager-create" @click="emit('create', 'template')">
          <Plus :size="16" aria-hidden="true" />
          {{ locale.t('projects.create', 'New project') }}
        </ElButton>
        <ElButton native-type="button" type="primary" data-quick-form-create @click="emit('quickCreate')">
          <Plus :size="16" aria-hidden="true" />{{ locale.t('projects.quickForm', 'Create a form') }}
        </ElButton>
      </div>
    </header>

    <section class="project-manager__content" :aria-label="locale.t('projects.title', 'Projects')">
      <div v-if="props.controller.projects.value.length" class="project-manager__list-heading">
        <ElInput ref="projectSearch" v-model="query" type="search" class="project-manager__search" clearable :placeholder="locale.t('projects.search', 'Search projects')" :aria-label="locale.t('projects.search', 'Search projects')">
          <template #prefix>
            <Search :size="16" aria-hidden="true" />
          </template>
        </ElInput>
        <div class="project-manager__list-summary">
          <span role="status" aria-live="polite">{{ hasQuery ? locale.t('projects.filteredCount', '{count} of {total} projects', { count: filteredProjects.length, total: props.controller.projects.value.length }) : locale.t('projects.listCount', '{count} projects', { count: filteredProjects.length }) }}</span>
        </div>
        <ElSelect v-model="sort" class="project-manager__sort" :aria-label="locale.t('projects.sort', 'Sort projects')" append-to="#workbench-overlays">
          <ElOption value="updated" :label="locale.t('projects.sortUpdated', 'Recently updated')" />
          <ElOption value="name" :label="locale.t('projects.sortName', 'Project name')" />
        </ElSelect>
        <BrowseViewToggle v-model="browseView" :locale="props.controller.localeOptions.value" />
      </div>

      <p v-if="!props.controller.initialized.value" class="project-manager__state" role="status">
        {{ locale.t('status.loading', 'Loading') }}
      </p>
      <div v-else-if="filteredProjects.length" class="project-manager__list" :data-view="browseView">
        <article v-for="project in filteredProjects" :key="project.id" class="project-row project-card" :class="{ 'is-opening': openingId === project.id }" :data-project-id="project.id">
          <ControlHint class="project-card__open" :reason="busyReason">
            <button type="button" class="project-row__main project-card__main" :aria-label="project.name" :aria-busy="openingId === project.id" :disabled="!!busyReason" data-project-open @click="openProject(project)">
              <span class="project-card__identity">
                <span class="project-card__preview" aria-hidden="true">
                  <img v-if="projectImageSource(project)" :src="projectImageSource(project)" alt="">
                  <FolderOpen v-else :size="20" />
                </span>
                <span class="project-card__heading">
                  <small class="project-card__adapter">{{ adapterLabel(project.registryLock.adapter) }}</small>
                  <strong :title="project.name">{{ project.name }}</strong>
                </span>
              </span>
              <span class="project-row__counts project-card__counts">
                <span><Layers3 :size="14" aria-hidden="true" /><b>{{ project.surfaceCount }}</b> {{ locale.t('projects.surfaces', 'pages') }}</span>
                <span><Database :size="14" aria-hidden="true" /><b>{{ project.datasetCount }}</b> {{ locale.t('projects.datasets', 'datasets') }}</span>
                <span><Image :size="14" aria-hidden="true" /><b>{{ project.resourceCount }}</b> {{ locale.t('projects.resources', 'resources') }}</span>
              </span>
              <span v-if="openingId === project.id" class="project-card__open-state" role="status">
                <LoaderCircle :size="15" class="is-loading" aria-hidden="true" />
                {{ locale.t('projects.opening', 'Opening…') }}
              </span>
            </button>
          </ControlHint>
          <footer class="project-card__footer">
            <small class="project-card__meta" :title="formatUpdatedAt(project.updatedAt)">
              {{ locale.t('projects.updated', 'Updated {date}', { date: formatUpdatedAt(project.updatedAt) }) }}
            </small>
            <div class="project-card__actions">
              <ControlHint :reason="busyReason" :label="project.projectImage ? locale.t('projects.replaceImage', 'Replace image') : locale.t('projects.uploadImage', 'Upload image')">
                <ElUpload
                  class="project-card__upload"
                  data-project-image-upload
                  accept="image/*"
                  :auto-upload="false"
                  :show-file-list="false"
                  :disabled="!!busyReason"
                  :on-change="(file: UploadFile) => uploadProjectImage(project, file)"
                >
                  <span class="project-card__upload-trigger">
                    <Upload :size="16" aria-hidden="true" />
                    <span class="sr-only">{{ project.projectImage ? locale.t('projects.replaceImage', 'Replace image') : locale.t('projects.uploadImage', 'Upload image') }}</span>
                  </span>
                </ElUpload>
              </ControlHint>
              <ControlHint :reason="busyReason" :label="activeMenuId === project.id ? undefined : locale.t('projects.moreActions', 'Project actions')">
                <ElDropdown ref="projectMenus" trigger="click" placement="bottom-end" :disabled="!!busyReason" append-to="#workbench-overlays" @command="runAction($event, project)" @visible-change="setMenuVisible(project.id, $event)">
                  <ElButton native-type="button" text class="project-card__more" :disabled="!!busyReason" :aria-label="locale.t('projects.moreActions', 'Project actions')" @keydown.esc.stop="closeProjectMenus">
                    <MoreHorizontal :size="18" aria-hidden="true" />
                  </ElButton>
                  <template #dropdown>
                    <ElDropdownMenu class="project-card__menu">
                      <ElDropdownItem command="rename">
                        <Pencil :size="15" aria-hidden="true" />{{ locale.t('projects.rename', 'Rename') }}
                      </ElDropdownItem>
                      <ElDropdownItem command="duplicate">
                        <Copy :size="15" aria-hidden="true" />{{ locale.t('projects.duplicate', 'Duplicate') }}
                      </ElDropdownItem>
                      <ElDropdownItem command="export">
                        <Download :size="15" aria-hidden="true" />{{ locale.t('projects.export', 'Export project') }}
                      </ElDropdownItem>
                      <ElDropdownItem command="export-source">
                        <Code2 :size="15" aria-hidden="true" />{{ locale.t('projects.exportSource', 'Export project source') }}
                      </ElDropdownItem>
                      <ElDropdownItem v-if="project.projectImage" command="remove-image">
                        <Image :size="15" aria-hidden="true" />{{ locale.t('projects.removeImage', 'Remove image') }}
                      </ElDropdownItem>
                      <ElDropdownItem command="delete" divided class="project-card__delete">
                        <Trash2 :size="15" aria-hidden="true" />{{ locale.t('projects.delete', 'Delete') }}
                      </ElDropdownItem>
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
              </ControlHint>
            </div>
          </footer>
        </article>
      </div>
      <div v-else class="project-manager__empty">
        <div class="project-manager__empty-icon">
          <Search v-if="hasQuery" :size="26" aria-hidden="true" /><FolderOpen v-else :size="26" aria-hidden="true" />
        </div>
        <div>
          <strong>{{ hasQuery ? locale.t('projects.noResults', 'No matching projects') : locale.t('projects.empty', 'Create your first project') }}</strong>
          <p>{{ hasQuery ? locale.t('projects.noResultsHint', 'Try a project name or component library, or clear the search.') : locale.t('projects.quickFormHint', 'Choose a form template and start designing. A project is created for you; export Vue source when ready.') }}</p>
        </div>
        <ElButton v-if="hasQuery" native-type="button" @click="clearSearch">
          {{ locale.t('projects.clearSearch', 'Clear search') }}
        </ElButton>
        <div v-else class="project-manager__empty-actions">
          <ElButton native-type="button" @click="emit('create', 'json')">
            <FileJson2 :size="15" aria-hidden="true" />{{ locale.t('projects.import', 'Import JSON') }}
          </ElButton>
          <ElButton native-type="button" type="primary" @click="emit('quickCreate')">
            <Plus :size="16" aria-hidden="true" />{{ locale.t('projects.quickForm', 'Create a form') }}
          </ElButton>
        </div>
      </div>
    </section>

    <ElDialog v-model="renameOpen" width="min(420px, calc(var(--wb-viewport-width) - 32px))" append-to="#workbench-overlays" :title="locale.t('projects.renameTitle', 'Rename project')" @opened="renameInput?.focus?.()">
      <ElInput ref="renameInput" v-model="renameValue" maxlength="160" show-word-limit :aria-label="locale.t('projects.name', 'Project name')" @keyup.enter="confirmRename" />
      <template #footer>
        <ElButton native-type="button" @click="renameOpen = false">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <ControlHint :reason="busyReason || (!renameValue.trim() ? locale.t('projects.nameRequired', 'Enter a project name to save.') : undefined)">
          <ElButton native-type="button" type="primary" :loading="props.controller.busy.value" :disabled="!!busyReason || !renameValue.trim()" @click="confirmRename">
            {{ locale.t('action.save', 'Save') }}
          </ElButton>
        </ControlHint>
      </template>
    </ElDialog>

    <ElDialog v-model="deleteOpen" width="min(420px, calc(var(--wb-viewport-width) - 32px))" append-to="#workbench-overlays" :title="locale.t('projects.deleteTitle', 'Delete project')">
      <p>{{ locale.t('projects.deleteConfirm', 'Delete “{name}” and its local data? This cannot be undone.', { name: deleteTarget?.name ?? '' }) }}</p>
      <template #footer>
        <ElButton native-type="button" @click="deleteOpen = false">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <ControlHint :reason="busyReason">
          <ElButton native-type="button" type="danger" :loading="props.controller.busy.value" :disabled="!!busyReason" @click="confirmDelete">
            {{ locale.t('projects.delete', 'Delete') }}
          </ElButton>
        </ControlHint>
      </template>
    </ElDialog>

    <ElAlert v-if="props.ui.message.value" class="project-manager__message" :title="props.ui.message.value" type="error" show-icon closable @close="props.ui.clearMessage" />
  </main>
</template>
