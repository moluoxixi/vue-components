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

type MobileAction = 'openAppearance' | 'openSurfaces' | 'toggleLocale'

function chooseMobileAction(action: MobileAction): void {
  void nextTick(() => {
    mobileMenuTrigger.value?.$el?.focus()
    switch (action) {
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
      <button type="button" :title="locale.t('pages.manage', 'Manage pages')" @click="emit('openSurfaces')">
        {{ project.name }}
      </button>
      <span class="workspace-context__separator" aria-hidden="true">/</span>
      <strong>{{ currentSurface.name }}</strong>
    </div>

    <div
      v-if="project"
      class="workbench-view-switch"
      role="group"
      :aria-label="locale.t('workbench.views', 'Workspace view')"
    >
      <button
        type="button"
        :aria-label="locale.t('workbench.design', 'Design')"
        :title="locale.t('workbench.design', 'Design')"
        :aria-pressed="!previewOpen && !sourceOpen"
        :class="{ 'is-active': !previewOpen && !sourceOpen }"
        @click="emit('showDesign')"
      >
        <MousePointer2 :size="14" aria-hidden="true" />
        <span>{{ locale.t('workbench.design', 'Design') }}</span>
      </button>
      <button
        type="button"
        :aria-pressed="previewOpen === true"
        :class="{ 'is-active': previewOpen }"
        :title="locale.t('preview.title', 'Experience')"
        :aria-label="previewOpen ? locale.t('preview.hide', 'Hide preview') : locale.t('preview.show', 'Show preview')"
        @click="emit('togglePreview')"
      >
        <Play :size="14" aria-hidden="true" />
        <span>{{ locale.t('preview.title', 'Experience') }}</span>
      </button>
      <button
        type="button"
        :aria-label="locale.t('workbench.code', 'Handoff')"
        :title="locale.t('workbench.code', 'Handoff')"
        :aria-pressed="sourceOpen === true"
        :class="{ 'is-active': sourceOpen }"
        @click="emit('export', 'source')"
      >
        <Code2 :size="15" aria-hidden="true" />
        <span>{{ locale.t('workbench.code', 'Handoff') }}</span>
      </button>
    </div>

    <div class="topbar-actions">
      <button
        v-if="project"
        type="button"
        class="studio-command-trigger"
        :aria-label="locale.t('studio.commands', 'Command center')"
        aria-keyshortcuts="Control+K Meta+K"
        @click="emit('openCommands')"
      >
        <Search :size="15" aria-hidden="true" /><kbd>Ctrl K</kbd>
      </button>
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
      <ElDropdown
        v-if="project"
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
          :class="{ 'is-command-disabled': Boolean(saveUnavailableReason) }"
          :aria-label="saveAccessibleLabel"
          :title="saveAccessibleLabel"
          :aria-disabled="saveUnavailableReason ? 'true' : undefined"
        >
          <Save :size="16" aria-hidden="true" />
          <span class="topbar-command-label">{{ locale.t('action.save', 'Save') }}</span>
          <ChevronDown class="export-chevron" :size="13" aria-hidden="true" />
        </ElButton>
        <template #dropdown>
          <ElDropdownMenu class="export-menu-popover save-menu-popover" data-save-menu>
            <ElDropdownItem command="save" :disabled="!dirty">
              <Save :size="15" aria-hidden="true" />
              <span>{{ locale.t('save.now', 'Save now') }}</span>
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
        :locale="locale"
        :palette-family="paletteFamily"
        :theme-preference="themePreference"
        @set-palette-family="emit('setPaletteFamily', $event)"
        @set-theme-preference="emit('setThemePreference', $event)"
      />
      <ElDropdown
        class="mobile-action-menu"
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
          :title="locale.t('workbench.moreActions', 'More actions')"
          data-create-trigger="topbar-mobile-menu"
          circle
        >
          <MoreHorizontal :size="18" aria-hidden="true" />
        </ElButton>
        <template #dropdown>
          <ElDropdownMenu class="mobile-action-popover" data-mobile-action-menu>
            <ElDropdownItem v-if="project" class="topbar-status-item" disabled>
              <span role="status">v{{ repositoryRevision ?? 0 }} · {{ statusLabel }}</span>
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
    </div>
  </header>
</template>
