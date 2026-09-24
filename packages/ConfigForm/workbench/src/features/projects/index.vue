<script setup lang="ts">
import type { ProjectSummary } from '@moluoxixi/config-form-model'
import type { ProjectManagerEmits, ProjectManagerProps } from './types'
import {
  Copy,
  Download,
  FileJson2,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

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

const filteredProjects = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase()
  return controller.projects.value.filter(project => !normalized
    || project.name.toLocaleLowerCase().includes(normalized)
    || project.registryLock.adapter.toLocaleLowerCase().includes(normalized))
})

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(locale.value.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
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
  if (command === 'delete')
    showDelete(project)
}
</script>

<template>
  <main class="project-manager" :data-theme="ui.resolvedTheme.value" :data-palette="ui.paletteFamily.value">
    <header class="project-manager__topbar">
      <div class="brand-lockup"><span>ConfigForm</span><strong>Studio</strong></div>
      <div class="project-manager__commands">
        <ElButton native-type="button" data-create-trigger="project-manager-import" @click="emit('create', 'json')">
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
          <p>{{ locale.t('projects.subtitle', 'Local UI prototypes and their independent Surfaces.') }}</p>
        </div>
        <ElInput v-model="query" class="project-manager__search" clearable :placeholder="locale.t('projects.search', 'Search projects')" :aria-label="locale.t('projects.search', 'Search projects')">
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </ElInput>
      </div>

      <p v-if="!controller.initialized.value" class="project-manager__state" role="status">{{ locale.t('status.loading', 'Loading') }}</p>
      <div v-else-if="filteredProjects.length" class="project-manager__list">
        <article v-for="project in filteredProjects" :key="project.id" class="project-row" :data-project-id="project.id">
          <button type="button" class="project-row__main" @click="openProject(project)">
            <span class="project-row__icon"><FolderOpen :size="20" aria-hidden="true" /></span>
            <span class="project-row__identity">
              <strong>{{ project.name }}</strong>
              <small>{{ project.registryLock.adapter }} · {{ formatUpdatedAt(project.updatedAt) }}</small>
            </span>
            <span class="project-row__counts">
              <span>{{ project.surfaceCount }} {{ locale.t('projects.surfaces', 'Surfaces') }}</span>
              <span>{{ project.datasetCount }} {{ locale.t('projects.datasets', 'Datasets') }}</span>
              <span>{{ project.resourceCount }} {{ locale.t('projects.resources', 'Resources') }}</span>
            </span>
          </button>
          <ElDropdown trigger="click" placement="bottom-end" append-to="#workbench-overlays" @command="runAction($event, project)">
            <ElButton native-type="button" circle :aria-label="locale.t('projects.moreActions', 'Project actions')"><MoreHorizontal :size="17" aria-hidden="true" /></ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem command="rename"><Pencil :size="15" aria-hidden="true" />{{ locale.t('projects.rename', 'Rename') }}</ElDropdownItem>
                <ElDropdownItem command="duplicate"><Copy :size="15" aria-hidden="true" />{{ locale.t('projects.duplicate', 'Duplicate') }}</ElDropdownItem>
                <ElDropdownItem command="export"><Download :size="15" aria-hidden="true" />{{ locale.t('projects.export', 'Export JSON') }}</ElDropdownItem>
                <ElDropdownItem command="delete" divided><Trash2 :size="15" aria-hidden="true" />{{ locale.t('projects.delete', 'Delete') }}</ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </article>
      </div>
      <div v-else class="project-manager__empty">
        <FolderOpen :size="28" aria-hidden="true" />
        <strong>{{ query ? locale.t('projects.noResults', 'No matching projects') : locale.t('projects.empty', 'No projects yet') }}</strong>
        <ElButton v-if="!query" native-type="button" type="primary" @click="emit('create', 'template')"><Plus :size="16" aria-hidden="true" />{{ locale.t('projects.create', 'New project') }}</ElButton>
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
