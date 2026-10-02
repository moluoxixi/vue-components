<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import type { ProjectSummary } from '@moluoxixi/config-form-model'
import type { ProjectImageInput, ProjectManagerEmits, ProjectManagerProps } from './types'
import {
  Copy,
  Database,
  Download,
  FileJson2,
  FolderOpen,
  Image,
  Layers3,
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
  return controller.projects.value.filter(project => !normalized
    || project.name.toLocaleLowerCase().includes(normalized)
    || project.registryLock.adapter.toLocaleLowerCase().includes(normalized))
})

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

watch(() => controller.projects.value, projects => {
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
  await controller.requestOpenProject(project.id)
  if (controller.currentProject.value?.id === project.id)
    emit('open')
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
      <div class="brand-lockup">
        <span class="brand-lockup__mark" aria-hidden="true">C</span>
        <div class="brand-lockup__copy">
          <span>ConfigForm</span>
          <strong>Studio</strong>
        </div>
      </div>
      <div class="project-manager__topbar-context">
        <span>{{ locale.t('projects.workspaceLabel', 'Engineering workspace') }}</span>
        <strong>{{ locale.t('projects.title', 'Projects') }}</strong>
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
          <span class="project-manager__eyebrow">{{ locale.t('projects.eyebrow', 'PROJECT SPACE') }}</span>
          <h1>{{ locale.t('projects.title', 'Projects') }}</h1>
          <p>{{ locale.t('projects.subtitle', 'Engineering projects with their pages, data, and resources.') }}</p>
        </div>
        <ElInput v-model="query" class="project-manager__search" clearable :placeholder="locale.t('projects.search', 'Search projects')" :aria-label="locale.t('projects.search', 'Search projects')">
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </ElInput>
      </div>

      <section class="project-manager__overview" :aria-label="locale.t('projects.overview', 'Project overview')">
        <div class="project-manager__overview-intro">
          <span class="project-manager__overview-kicker">{{ locale.t('projects.overviewKicker', 'Workspace inventory') }}</span>
          <strong>{{ locale.t('projects.overviewTitle', 'Everything your Studio can open') }}</strong>
        </div>
        <div class="project-manager__stats">
          <span class="project-manager__stat"><strong>{{ projectStats.projects }}</strong><small>{{ locale.t('projects.count', 'projects') }}</small></span>
          <span class="project-manager__stat"><strong>{{ projectStats.pages }}</strong><small>{{ locale.t('projects.surfaces', 'pages') }}</small></span>
          <span class="project-manager__stat"><strong>{{ projectStats.datasets }}</strong><small>{{ locale.t('projects.datasets', 'datasets') }}</small></span>
          <span class="project-manager__stat"><strong>{{ projectStats.resources }}</strong><small>{{ locale.t('projects.resources', 'resources') }}</small></span>
        </div>
      </section>

      <div class="project-manager__list-heading">
        <div>
          <h2>{{ locale.t('projects.listTitle', 'Engineering projects') }}</h2>
          <span>{{ locale.t('projects.listCount', '{count} projects', { count: filteredProjects.length }) }}</span>
        </div>
        <span class="project-manager__list-rule" aria-hidden="true" />
      </div>

      <p v-if="!controller.initialized.value" class="project-manager__state" role="status">{{ locale.t('status.loading', 'Loading') }}</p>
      <div v-else-if="filteredProjects.length" class="project-manager__list">
        <article v-for="project in filteredProjects" :key="project.id" class="project-row project-card" :data-project-id="project.id">
          <button type="button" class="project-row__main project-card__main" :aria-label="project.name" data-project-open @click="openProject(project)">
            <span class="project-card__preview" aria-hidden="true">
              <img v-if="projectImageSource(project)" :src="projectImageSource(project)" alt="" />
              <span v-else class="project-card__preview-placeholder"><FolderOpen :size="28" /></span>
              <span class="project-card__preview-sheen" />
            </span>
            <span class="project-card__body">
              <span class="project-card__title-row">
                <strong>{{ project.name }}</strong>
                <span v-if="project.homeSurfaceId" class="project-card__status">{{ locale.t('projects.ready', 'Ready') }}</span>
              </span>
              <small class="project-card__meta"><span class="project-row__adapter">{{ adapterLabel(project.registryLock.adapter) }}</span><span aria-hidden="true"> · </span>{{ formatUpdatedAt(project.updatedAt) }}</small>
              <span class="project-row__counts project-card__counts">
                <span><Layers3 :size="13" aria-hidden="true" />{{ project.surfaceCount }} {{ locale.t('projects.surfaces', 'pages') }}</span>
                <span><Database :size="13" aria-hidden="true" />{{ project.datasetCount }} {{ locale.t('projects.datasets', 'datasets') }}</span>
                <span><Image :size="13" aria-hidden="true" />{{ project.resourceCount }} {{ locale.t('projects.resources', 'resources') }}</span>
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
              <ElButton native-type="button" size="small" text circle :aria-label="locale.t('projects.moreActions', 'Project actions')"><MoreHorizontal :size="17" aria-hidden="true" /></ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem command="rename"><Pencil :size="15" aria-hidden="true" />{{ locale.t('projects.rename', 'Rename') }}</ElDropdownItem>
                  <ElDropdownItem command="duplicate"><Copy :size="15" aria-hidden="true" />{{ locale.t('projects.duplicate', 'Duplicate') }}</ElDropdownItem>
                  <ElDropdownItem command="export"><Download :size="15" aria-hidden="true" />{{ locale.t('projects.export', 'Export project') }}</ElDropdownItem>
                  <ElDropdownItem v-if="project.projectImage" command="remove-image"><Image :size="15" aria-hidden="true" />{{ locale.t('projects.removeImage', 'Remove image') }}</ElDropdownItem>
                  <ElDropdownItem command="delete" divided><Trash2 :size="15" aria-hidden="true" />{{ locale.t('projects.delete', 'Delete') }}</ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </footer>
        </article>
      </div>
      <div v-else class="project-manager__empty">
        <div class="project-manager__empty-icon"><FolderOpen :size="26" aria-hidden="true" /></div>
        <div>
          <strong>{{ query ? locale.t('projects.noResults', 'No matching projects') : locale.t('projects.empty', 'No projects yet') }}</strong>
          <p v-if="!query">{{ locale.t('projects.emptyBody', 'Create an engineering project to start arranging pages.') }}</p>
        </div>
        <div v-if="!query" class="project-manager__empty-actions">
          <ElButton native-type="button" @click="emit('create', 'json')"><FileJson2 :size="15" aria-hidden="true" />{{ locale.t('projects.import', 'Import JSON') }}</ElButton>
          <ElButton native-type="button" type="primary" @click="emit('create', 'template')"><Plus :size="16" aria-hidden="true" />{{ locale.t('projects.create', 'New project') }}</ElButton>
        </div>
      </div>
    </section>

    <ElDialog v-model="renameOpen" width="min(420px, calc(100vw - 32px))" append-to="#workbench-overlays" :title="locale.t('projects.renameTitle', 'Rename project')" @opened="renameInput?.focus?.()">
      <ElInput ref="renameInput" v-model="renameValue" maxlength="160" show-word-limit :aria-label="locale.t('projects.name', 'Project name')" @keyup.enter="confirmRename" />
      <template #footer>
        <ElButton native-type="button" @click="renameOpen = false">{{ locale.t('action.cancel', 'Cancel') }}</ElButton>
        <ElButton native-type="button" type="primary" :loading="controller.busy.value" :disabled="!renameValue.trim()" @click="confirmRename">{{ locale.t('action.save', 'Save') }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="deleteOpen" width="min(420px, calc(100vw - 32px))" append-to="#workbench-overlays" :title="locale.t('projects.deleteTitle', 'Delete project')">
      <p>{{ locale.t('projects.deleteConfirm', 'Delete “{name}” and its local data? This cannot be undone.', { name: deleteTarget?.name ?? '' }) }}</p>
      <template #footer>
        <ElButton native-type="button" @click="deleteOpen = false">{{ locale.t('action.cancel', 'Cancel') }}</ElButton>
        <ElButton native-type="button" type="danger" :loading="controller.busy.value" @click="confirmDelete">{{ locale.t('projects.delete', 'Delete') }}</ElButton>
      </template>
    </ElDialog>

    <ElAlert v-if="ui.message.value" class="project-manager__message" :title="ui.message.value" type="error" show-icon closable @close="ui.clearMessage" />
  </main>
</template>
