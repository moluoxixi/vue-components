<script setup lang="ts">
import type { WorkbenchTopbarEmits, WorkbenchTopbarProps } from '../types'
import {
  BookmarkPlus,
  ChevronDown,
  Code2,
  Files,
  FolderKanban,
  History,
  Languages,
  MoreHorizontal,
  MousePointer2,
  PanelsTopLeft,
  Play,
  Save,
  Search,
  Settings2,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import WorkbenchAppearancePopover from './WorkbenchAppearancePopover.vue'
import WorkbenchCommandHint from './WorkbenchCommandHint/index.vue'
import WorkspaceStatus from './WorkspaceStatus/index.vue'

const props = defineProps<WorkbenchTopbarProps>()

const emit = defineEmits<WorkbenchTopbarEmits>()

const mobileMenuTrigger = useTemplateRef<{ $el?: HTMLButtonElement }>('mobileMenuTrigger')
const saveTrigger = useTemplateRef<{ $el?: HTMLButtonElement }>('saveTrigger')
const locale = computed(() => createDesignerLocale(props.locale))
const pageManagerInOverflow = ref(false)
const saveUnavailableReason = computed(
  () => props.configError
    || (props.busy ? locale.value.t('action.busyUnavailable', 'Wait for the current operation to finish') : undefined),
)
const saveAccessibleLabel = computed(() =>
  saveUnavailableReason.value
    ? `${locale.value.t('save.menu', 'Save options')} · ${saveUnavailableReason.value}`
    : locale.value.t('save.menu', 'Save options'),
)
let narrowTopbarQuery: MediaQueryList | undefined

function updateSurfaceManagerPlacement(event: Pick<MediaQueryListEvent, 'matches'> | MediaQueryList): void {
  pageManagerInOverflow.value = event.matches
}

onMounted(() => {
  if (typeof window.matchMedia !== 'function')
    return
  narrowTopbarQuery = window.matchMedia('(max-width: 700px)')
  updateSurfaceManagerPlacement(narrowTopbarQuery)
  narrowTopbarQuery.addEventListener('change', updateSurfaceManagerPlacement)
})

onBeforeUnmount(() => narrowTopbarQuery?.removeEventListener('change', updateSurfaceManagerPlacement))

type MobileAction = 'openAppearance' | 'openCommands' | 'openProjects' | 'openSurfaces' | 'toggleLocale'

function chooseMobileAction(action: MobileAction): void {
  void nextTick(() => {
    mobileMenuTrigger.value?.$el?.focus()
    switch (action) {
      case 'openCommands':
        emit('openCommands')
        break
      case 'openProjects':
        emit('openProjects')
        break
      case 'openSurfaces':
        emit('openSurfaces')
        break
      case 'toggleLocale':
        emit('toggleLocale')
        break
      case 'openAppearance':
        emit('openAppearance')
        break
    }
  })
}

function chooseSaveAction(action: 'save' | 'checkpoint' | 'versions'): void {
  void nextTick(() => {
    saveTrigger.value?.$el?.focus()
    if (action === 'save')
      emit('save')
    else if (action === 'checkpoint')
      emit('createCheckpoint')
    else
      emit('openVersions')
  })
}
</script>

<template>
  <header class="workbench-topbar">
    <div class="brand-lockup">
      <span class="brand-lockup__mark"><PanelsTopLeft :size="16" aria-hidden="true" /></span>
      <strong>ConfigForm</strong>
      <span class="brand-lockup__studio">Studio</span>
    </div>

    <div
      v-if="project && currentSurface"
      class="workspace-context"
      :aria-label="locale.t('workbench.context', 'Current project and Surface')"
    >
      <WorkbenchCommandHint :label="locale.t('pages.manage', 'Manage pages')">
        <button type="button" @click="emit('openSurfaces')">
          {{ project.name }}
        </button>
      </WorkbenchCommandHint>
      <span class="workspace-context__separator" aria-hidden="true">/</span>
      <strong>{{ currentSurface.name }}</strong>
      <WorkspaceStatus v-if="storageInfo" :storage="storageInfo" :locale="localeId" />
    </div>

    <div
      v-if="project"
      class="workbench-view-switch"
      role="group"
      :aria-label="locale.t('workbench.views', 'Workspace view')"
    >
      <WorkbenchCommandHint :label="locale.locale === 'zh-CN' ? '设计：添加字段，调整布局、属性和交互' : 'Design: add fields and edit layout, properties and interactions'">
        <button
          type="button"
          :aria-label="locale.t('workbench.design', 'Design')"
          :aria-pressed="!previewOpen && !sourceOpen"
          :class="{ 'is-active': !previewOpen && !sourceOpen }"
          @click="emit('showDesign')"
        >
          <MousePointer2 :size="14" aria-hidden="true" />
          <span>{{ locale.t('workbench.design', 'Design') }}</span>
        </button>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint :label="locale.locale === 'zh-CN' ? '体验：填写表单，验证校验规则和页面交互' : 'Experience: fill in the form and try validation and interactions'">
        <button
          type="button"
          :aria-pressed="previewOpen === true"
          :class="{ 'is-active': previewOpen }"
          :aria-label="previewOpen ? locale.t('preview.hide', 'Hide preview') : locale.t('preview.show', 'Show preview')"
          @click="emit('togglePreview')"
        >
          <Play :size="14" aria-hidden="true" />
          <span>{{ locale.t('preview.title', 'Experience') }}</span>
        </button>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint :label="locale.locale === 'zh-CN' ? '交付：查看、复制或下载 Vue 源码与 ConfigForm 绑定代码' : 'Handoff: inspect, copy or download Vue source and ConfigForm bindings'">
        <button
          type="button"
          :aria-label="locale.t('workbench.code', 'Handoff')"
          :aria-pressed="sourceOpen === true"
          :class="{ 'is-active': sourceOpen }"
          @click="emit('export', 'source')"
        >
          <Code2 :size="15" aria-hidden="true" />
          <span>{{ locale.t('workbench.code', 'Handoff') }}</span>
        </button>
      </WorkbenchCommandHint>
    </div>

    <div class="topbar-actions">
      <WorkbenchCommandHint v-if="project" :label="locale.locale === 'zh-CN' ? '搜索并执行工作区操作' : 'Search and run workspace commands'" shortcut="Ctrl / ⌘ K">
        <button
          type="button"
          class="studio-command-trigger"
          :aria-label="locale.t('studio.commands', 'Command center')"
          aria-keyshortcuts="Control+K Meta+K"
          @click="emit('openCommands')"
        >
          <Search :size="15" aria-hidden="true" /><kbd>Ctrl K</kbd>
        </button>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint :label="locale.t('projects.back', 'Back to projects')">
        <ElButton
          native-type="button"
          class="topbar-secondary-action"
          circle
          :aria-label="locale.t('projects.back', 'Back to projects')"
          @click="emit('openProjects')"
        >
          <FolderKanban :size="17" aria-hidden="true" />
        </ElButton>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint v-if="project" :label="locale.t('pages.manage', 'Manage pages')">
        <ElButton
          native-type="button"
          class="mobile-page-manager-button"
          :aria-label="locale.t('pages.manage', 'Manage pages')"
          circle
          @click="emit('openSurfaces')"
        >
          <Files :size="17" aria-hidden="true" />
        </ElButton>
      </WorkbenchCommandHint>
      <span v-if="project" class="revision-state" :class="{ 'is-dirty': dirty }" aria-live="polite">
        v{{ repositoryRevision ?? 0 }} · {{ statusLabel }}
      </span>
      <WorkbenchCommandHint v-if="project" detached :label="locale.t('save.menu', 'Save options')" :disabled-reason="saveUnavailableReason">
        <ElDropdown
          class="save-menu export-menu"
          :disabled="Boolean(saveUnavailableReason)"
          trigger="click"
          placement="bottom-end"
          :show-timeout="0"
          :hide-timeout="0"
          append-to="#workbench-overlays"
          @command="chooseSaveAction"
        >
          <ElButton
            ref="saveTrigger"
            native-type="button"
            class="save-menu-trigger"
            :class="{ 'is-command-disabled': Boolean(saveUnavailableReason) }"
            :aria-label="saveAccessibleLabel"
            :aria-disabled="saveUnavailableReason ? 'true' : undefined"
          >
            <span class="save-menu-trigger__content">
              <Save :size="15" aria-hidden="true" />
              <span class="topbar-command-label">{{ locale.t('action.save', 'Save') }}</span>
              <ChevronDown class="export-chevron" :size="12" aria-hidden="true" />
            </span>
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu class="export-menu-popover save-menu-popover" data-save-menu>
              <ElDropdownItem command="save" :disabled="!dirty">
                <WorkbenchCommandHint :label="locale.t('save.now', 'Save now')" :disabled-reason="!dirty ? (locale.locale === 'zh-CN' ? '当前更改已保存；修改设计后可再次保存' : 'All changes are saved; edit the design to save again') : undefined">
                  <span class="menu-command-content">
                    <Save :size="15" aria-hidden="true" />
                    <span>{{ locale.t('save.now', 'Save now') }}</span>
                  </span>
                </WorkbenchCommandHint>
              </ElDropdownItem>
              <ElDropdownItem command="checkpoint">
                <BookmarkPlus :size="15" aria-hidden="true" />
                <span>{{ locale.t('save.checkpoint', 'Create named checkpoint') }}</span>
              </ElDropdownItem>
              <ElDropdownItem command="versions">
                <History :size="15" aria-hidden="true" />
                <span>{{ locale.t('save.history', 'Version history') }}</span>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint
        :label="
          localeId === 'zh-CN'
            ? locale.t('locale.switchToEnglish', 'Switch to English')
            : locale.t('locale.switchToChinese', 'Switch to Chinese')
        "
      >
        <ElButton
          native-type="button"
          class="topbar-secondary-action"
          :aria-label="
            localeId === 'zh-CN'
              ? locale.t('locale.switchToEnglish', 'Switch to English')
              : locale.t('locale.switchToChinese', 'Switch to Chinese')
          "
          circle
          @click="emit('toggleLocale')"
        >
          <Languages :size="17" aria-hidden="true" />
        </ElButton>
      </WorkbenchCommandHint>
      <WorkbenchAppearancePopover
        trigger-class="topbar-secondary-action"
        :locale="props.locale"
        :palette-family="paletteFamily"
        :theme-preference="themePreference"
        @set-palette-family="emit('setPaletteFamily', $event)"
        @set-theme-preference="emit('setThemePreference', $event)"
      />
      <WorkbenchCommandHint detached :label="locale.locale === 'zh-CN' ? '更多：项目、页面、语言和外观设置' : 'More: projects, pages, language and appearance settings'" anchor-class="mobile-action-menu">
        <ElDropdown
          trigger="click"
          placement="bottom-end"
          :show-timeout="0"
          :hide-timeout="0"
          append-to="#workbench-overlays"
          @command="chooseMobileAction"
        >
          <ElButton
            ref="mobileMenuTrigger"
            native-type="button"
            :aria-label="locale.t('workbench.moreActions', 'More actions')"
            data-create-trigger="topbar-mobile-menu"
            circle
          >
            <MoreHorizontal :size="18" aria-hidden="true" />
          </ElButton>
          <template #dropdown>
            <div v-if="project" class="topbar-status-item" role="status" data-mobile-action-status>
              v{{ repositoryRevision ?? 0 }} · {{ statusLabel }}
            </div>
            <ElDropdownMenu class="mobile-action-popover" data-mobile-action-menu>
              <ElDropdownItem command="openProjects">
                <FolderKanban :size="15" aria-hidden="true" /><span>{{ locale.t('projects.back', 'Back to projects') }}</span>
              </ElDropdownItem>
              <ElDropdownItem v-if="project" command="openCommands">
                <Search :size="15" aria-hidden="true" /><span>{{ locale.t('studio.commands', 'Command center') }}</span>
              </ElDropdownItem>
              <ElDropdownItem v-if="project && pageManagerInOverflow" command="openSurfaces">
                <Files :size="15" aria-hidden="true" /><span>{{ locale.t('pages.manage', 'Manage pages') }}</span>
              </ElDropdownItem>
              <ElDropdownItem command="toggleLocale">
                <Languages :size="15" aria-hidden="true" /><span>{{
                  localeId === 'zh-CN'
                    ? locale.t('locale.switchToEnglish', 'Switch to English')
                    : locale.t('locale.switchToChinese', 'Switch to Chinese')
                }}</span>
              </ElDropdownItem>
              <ElDropdownItem command="openAppearance">
                <Settings2 :size="15" aria-hidden="true" /><span>{{
                  locale.t('appearance.open', 'Open appearance settings')
                }}</span>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </WorkbenchCommandHint>
    </div>
  </header>
</template>
