<script setup lang="ts">
import type { ProjectSummary } from '@moluoxixi/config-form-model'
import type { UploadFile } from 'element-plus'
import type { ProjectImageInput, ProjectManagerEmits, ProjectManagerProps } from './types'
import {
  ArrowUpRight,
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

const props = defineProps<ProjectManagerProps>()
const emit = defineEmits<ProjectManagerEmits>()
const { controller, ui } = props
const locale = computed(() => createDesignerLocale(controller.localeOptions.value))
const query = ref('')
const sort = ref<'updated' | 'name'>('updated')
const openingId = ref<string>()
const projectSearch = useTemplateRef<{ focus: () => void }>('projectSearch')
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
  return controller.projects.value.filter(project => !normalized
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
    const bytes = await controller.readEmbeddedResource({
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

watch(() => controller.projects.value, (projects) => {
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

const projectStats = computed(() => {
  const projects = controller.projects.value
  return {
    projects: projects.length,
    pages: projects.reduce((total, project) => total + project.surfaceCount, 0),
    datasets: projects.reduce((total, project) => total + project.datasetCount, 0),
    resources: projects.reduce((total, project) => total + project.resourceCount, 0),
  }
})

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
  if (controller.busy.value || openingId.value)
    return
  openingId.value = project.id
  try {
    await controller.requestOpenProject(project.id)
    if (controller.currentProject.value?.id === project.id)
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
  if (!project)
    return
  if (await controller.renameProject(project.id, renameValue.value))
    renameOpen.value = false
}

function showDelete(project: ProjectSummary): void {
  deleteTarget.value = project
  deleteOpen.value = true
}

async function confirmDelete(): Promise<void> {
  const project = deleteTarget.value
  if (!project)
    return
  if (await controller.deleteProject(project.id)) {
    deleteOpen.value = false
    deleteTarget.value = undefined
  }
}

async function runAction(command: string, project: ProjectSummary): Promise<void> {
  if (command === 'rename') {
    showRename(project)
    return
  }
  if (command === 'duplicate') {
    if (await controller.duplicateProject(project.id))
      emit('open')
    return
  }
  if (command === 'export') {
    await controller.exportProject(project.id)
    return
  }
  if (command === 'export-source') {
    await controller.exportProjectSource(project.id)
    return
  }
  if (command === 'remove-image') {
    await controller.removeProjectImage(project.id)
    return
  }
  if (command === 'delete')
    showDelete(project)
}

async function uploadProjectImage(project: ProjectSummary, uploadFile: UploadFile): Promise<void> {
  const file = uploadFile.raw
  if (!file)
    return
  const mediaType = file.type.toLocaleLowerCase().startsWith('image/')
    ? file.type
    : ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' } as Record<string, string>)[file.name.split('.').at(-1)?.toLocaleLowerCase() ?? '']
  if (!mediaType)
    return
  await controller.setProjectImage(project.id, {
    name: file.name,
    fileName: file.name,
    mediaType,
    bytes: new Uint8Array(await file.arrayBuffer()),
  } satisfies ProjectImageInput)
}
</script>

<template>
  <main class="project-manager" :data-theme="ui.resolvedTheme.value" :data-palette="ui.paletteFamily.value">
    <header class="project-manager__topbar">
      <div class="project-manager__topbar-context">
        <FolderOpen :size="16" aria-hidden="true" />
        <span>{{ locale.t('projects.workspaceLabel', 'Project workspace') }}</span>
      </div>
      <div class="project-manager__commands">
        <ElButton v-if="controller.projects.value.length > 0" native-type="button" class="project-manager__import" data-create-trigger="project-manager-import" @click="emit('create', 'json')">
          <FileJson2 :size="16" aria-hidden="true" />
          {{ locale.t('projects.import', 'Import JSON') }}
        </ElButton>
        <ElButton native-type="button" type="primary" data-project-create data-create-trigger="project-manager-create" @click="emit('create', 'template')">
          <Plus :size="16" aria-hidden="true" />
          {{ locale.t('projects.create', 'New project') }}
        </ElButton>
      </div>
    </header>

    <section class="project-manager__content" :aria-label="locale.t('projects.title', 'Projects')">
      <div class="project-manager__heading">
        <div>
          <h1>{{ locale.t('projects.title', 'Projects') }}</h1>
          <p>{{ locale.t('projects.subtitle', 'Manage your forms, pages and data. Pick a project to continue designing.') }}</p>
        </div>
        <ElInput ref="projectSearch" v-model="query" class="project-manager__search" clearable :placeholder="locale.t('projects.search', 'Search projects')" :aria-label="locale.t('projects.search', 'Search projects')">
          <template #prefix>
            <Search :size="16" aria-hidden="true" />
          </template>
        </ElInput>
      </div>

      <section v-if="controller.projects.value.length" class="project-manager__overview" :aria-label="locale.t('projects.overview', 'Project overview')">
        <div class="project-manager__overview-intro">
          <span class="project-manager__overview-kicker">{{ locale.t('projects.overviewKicker', 'Workspace inventory') }}</span>
        </div>
        <div class="project-manager__stats">
          <span class="project-manager__stat"><strong>{{ projectStats.projects }}</strong><small>{{ locale.t('projects.count', 'projects') }}</small></span>
          <span class="project-manager__stat"><strong>{{ projectStats.pages }}</strong><small>{{ locale.t('projects.surfaces', 'pages') }}</small></span>
          <span class="project-manager__stat"><strong>{{ projectStats.datasets }}</strong><small>{{ locale.t('projects.datasets', 'datasets') }}</small></span>
          <span class="project-manager__stat"><strong>{{ projectStats.resources }}</strong><small>{{ locale.t('projects.resources', 'resources') }}</small></span>
        </div>
      </section>

      <div v-if="controller.projects.value.length" class="project-manager__list-heading">
        <div class="project-manager__list-summary">
          <h2>{{ locale.t('projects.listTitle', 'My projects') }}</h2>
          <span role="status" aria-live="polite">{{ hasQuery ? locale.t('projects.filteredCount', '{count} of {total} projects', { count: filteredProjects.length, total: controller.projects.value.length }) : locale.t('projects.listCount', '{count} projects', { count: filteredProjects.length }) }}</span>
        </div>
        <span class="project-manager__list-rule" aria-hidden="true" />
        <ElSelect v-model="sort" class="project-manager__sort" :aria-label="locale.t('projects.sort', 'Sort projects')" append-to="#workbench-overlays">
          <ElOption value="updated" :label="locale.t('projects.sortUpdated', 'Recently updated')" />
          <ElOption value="name" :label="locale.t('projects.sortName', 'Project name')" />
        </ElSelect>
      </div>

      <p v-if="!controller.initialized.value" class="project-manager__state" role="status">
        {{ locale.t('status.loading', 'Loading') }}
      </p>
      <div v-else-if="filteredProjects.length" class="project-manager__list">
        <article v-for="project in filteredProjects" :key="project.id" class="project-row project-card" :class="{ 'is-opening': openingId === project.id }" :data-project-id="project.id">
          <button type="button" class="project-row__main project-card__main" :aria-label="project.name" :aria-busy="openingId === project.id" :disabled="controller.busy.value || !!openingId" data-project-open @click="openProject(project)">
            <span class="project-card__preview" aria-hidden="true">
              <img v-if="projectImageSource(project)" :src="projectImageSource(project)" alt="">
              <span v-else class="project-card__preview-placeholder">
                <FolderOpen :size="21" />
                <strong>{{ project.name.trim().slice(0, 2).toUpperCase() }}</strong>
                <small>{{ adapterLabel(project.registryLock.adapter) }}</small>
              </span>
            </span>
            <span class="project-card__body">
              <span class="project-card__title-row">
                <strong :title="project.name">{{ project.name }}</strong>
                <span v-if="project.homeSurfaceId" class="project-card__status">{{ locale.t('projects.ready', 'Ready') }}</span>
              </span>
              <small class="project-card__meta">{{ locale.t('projects.updated', 'Updated {date}', { date: formatUpdatedAt(project.updatedAt) }) }}</small>
              <span class="project-row__counts project-card__counts">
                <span><Layers3 :size="13" aria-hidden="true" />{{ project.surfaceCount }} {{ locale.t('projects.surfaces', 'pages') }}</span>
                <span><Database :size="13" aria-hidden="true" />{{ project.datasetCount }} {{ locale.t('projects.datasets', 'datasets') }}</span>
                <span><Image :size="13" aria-hidden="true" />{{ project.resourceCount }} {{ locale.t('projects.resources', 'resources') }}</span>
              </span>
              <span class="project-card__open-state" :role="openingId === project.id ? 'status' : undefined">
                <LoaderCircle v-if="openingId === project.id" :size="15" class="is-loading" aria-hidden="true" />
                {{ openingId === project.id ? locale.t('projects.opening', 'Opening…') : locale.t('projects.open', 'Open project') }}
                <ArrowUpRight v-if="openingId !== project.id" :size="15" aria-hidden="true" />
              </span>
            </span>
          </button>
          <footer class="project-card__footer">
            <ElUpload
              class="project-card__upload"
              data-project-image-upload
              accept="image/*"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="(file: UploadFile) => uploadProjectImage(project, file)"
            >
              <span class="project-card__upload-trigger">
                <Upload :size="14" aria-hidden="true" />
                {{ project.projectImage ? locale.t('projects.replaceImage', 'Replace image') : locale.t('projects.uploadImage', 'Upload image') }}
              </span>
            </ElUpload>
            <ElDropdown trigger="click" placement="bottom-end" append-to="#workbench-overlays" @command="runAction($event, project)">
              <ElButton native-type="button" size="small" text circle :aria-label="locale.t('projects.moreActions', 'Project actions')">
                <MoreHorizontal :size="17" aria-hidden="true" />
              </ElButton>
              <template #dropdown>
                <ElDropdownMenu>
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
                  <ElDropdownItem command="delete" divided>
                    <Trash2 :size="15" aria-hidden="true" />{{ locale.t('projects.delete', 'Delete') }}
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </footer>
        </article>
      </div>
      <div v-else class="project-manager__empty">
        <div class="project-manager__empty-icon">
          <Search v-if="hasQuery" :size="26" aria-hidden="true" /><FolderOpen v-else :size="26" aria-hidden="true" />
        </div>
        <div>
          <strong>{{ hasQuery ? locale.t('projects.noResults', 'No matching projects') : locale.t('projects.empty', 'Create your first project') }}</strong>
          <p>{{ hasQuery ? locale.t('projects.noResultsHint', 'Try a project name or component library, or clear the search.') : locale.t('projects.emptyBody', 'Create a project, then start with a blank page or a template.') }}</p>
        </div>
        <ElButton v-if="hasQuery" native-type="button" @click="clearSearch">
          {{ locale.t('projects.clearSearch', 'Clear search') }}
        </ElButton>
        <div v-else class="project-manager__empty-actions">
          <ElButton native-type="button" @click="emit('create', 'json')">
            <FileJson2 :size="15" aria-hidden="true" />{{ locale.t('projects.import', 'Import JSON') }}
          </ElButton>
          <ElButton native-type="button" type="primary" @click="emit('create', 'template')">
            <Plus :size="16" aria-hidden="true" />{{ locale.t('projects.create', 'New project') }}
          </ElButton>
        </div>
      </div>
    </section>

    <ElDialog v-model="renameOpen" width="min(420px, calc(100vw - 32px))" append-to="#workbench-overlays" :title="locale.t('projects.renameTitle', 'Rename project')" @opened="renameInput?.focus?.()">
      <ElInput ref="renameInput" v-model="renameValue" maxlength="160" show-word-limit :aria-label="locale.t('projects.name', 'Project name')" @keyup.enter="confirmRename" />
      <template #footer>
        <ElButton native-type="button" @click="renameOpen = false">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <ElButton native-type="button" type="primary" :loading="controller.busy.value" :disabled="!renameValue.trim()" @click="confirmRename">
          {{ locale.t('action.save', 'Save') }}
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="deleteOpen" width="min(420px, calc(100vw - 32px))" append-to="#workbench-overlays" :title="locale.t('projects.deleteTitle', 'Delete project')">
      <p>{{ locale.t('projects.deleteConfirm', 'Delete “{name}” and its local data? This cannot be undone.', { name: deleteTarget?.name ?? '' }) }}</p>
      <template #footer>
        <ElButton native-type="button" @click="deleteOpen = false">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <ElButton native-type="button" type="danger" :loading="controller.busy.value" @click="confirmDelete">
          {{ locale.t('projects.delete', 'Delete') }}
        </ElButton>
      </template>
    </ElDialog>

    <ElAlert v-if="ui.message.value" class="project-manager__message" :title="ui.message.value" type="error" show-icon closable @close="ui.clearMessage" />
  </main>
</template>
