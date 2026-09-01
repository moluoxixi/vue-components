<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectPage, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { WorkbenchLocaleId } from '../locale'
import type { WorkbenchTheme } from './workbench-ui-store'
import {
  Braces,
  ChevronDown,
  Code2,
  Download,
  Files,
  Languages,
  MoreHorizontal,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  History,
  BookmarkPlus,
  Save,
  Sun,
  Workflow,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, useTemplateRef } from 'vue'

export type WorkbenchExportMode = 'source' | 'config'

const props = defineProps<{
  project?: ReadonlyProjectDocument
  busy?: boolean
  configError?: string
  currentPage?: ProjectPage
  dirty?: boolean
  flowOpen?: boolean
  locale?: DesignerLocaleOptions
  localeId: WorkbenchLocaleId
  previewOpen?: boolean
  repositoryRevision?: number
  statusLabel: string
  theme: WorkbenchTheme
}>()

const emit = defineEmits<{
  export: [mode: WorkbenchExportMode]
  newPage: []
  openFlow: []
  openPages: []
  openVersions: []
  createCheckpoint: []
  save: []
  toggleLocale: []
  togglePreview: []
  toggleTheme: []
}>()

const exportTrigger = useTemplateRef<{ $el?: HTMLButtonElement }>('exportTrigger')
const mobileMenuTrigger = useTemplateRef<{ $el?: HTMLButtonElement }>('mobileMenuTrigger')
const saveTrigger = useTemplateRef<{ $el?: HTMLButtonElement }>('saveTrigger')
const locale = computed(() => createDesignerLocale(props.locale))

type MobileAction = 'checkpoint' | 'newPage' | 'openFlow' | 'openPages' | 'save' | 'toggleLocale' | 'toggleTheme' | 'versions'

function chooseMobileAction(action: MobileAction): void {
  void nextTick(() => {
    mobileMenuTrigger.value?.$el?.focus()
    switch (action) {
      case 'newPage': emit('newPage'); break
      case 'openFlow': emit('openFlow'); break
      case 'openPages': emit('openPages'); break
      case 'save': emit('save'); break
      case 'checkpoint': emit('createCheckpoint'); break
      case 'versions': emit('openVersions'); break
      case 'toggleLocale': emit('toggleLocale'); break
      case 'toggleTheme': emit('toggleTheme'); break
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

function chooseExport(mode: WorkbenchExportMode): void {
  void nextTick(() => {
    exportTrigger.value?.$el?.focus()
    emit('export', mode)
  })
}
</script>

<template>
  <header class="workbench-topbar">
    <div class="brand-lockup">
      <span>ConfigForm</span>
      <strong>Workbench</strong>
    </div>

    <div v-if="project && currentPage" class="workspace-context" :aria-label="locale.t('workbench.context', 'Current project and page')">
      <span>{{ project.name }}</span>
      <strong>{{ currentPage.name }}</strong>
    </div>

    <div class="topbar-actions">
      <ElTooltip :content="locale.t('pages.manage', 'Manage pages')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
      <ElButton
        v-if="project"
        native-type="button"
        class="mobile-page-manager-button"
        :aria-label="locale.t('pages.manage', 'Manage pages')"
        circle
        @click="emit('openPages')"
      >
        <Files :size="17" aria-hidden="true" />
      </ElButton>
      </ElTooltip>
      <span v-if="project" class="revision-state" :class="{ 'is-dirty': dirty }" aria-live="polite">
        v{{ repositoryRevision ?? 0 }} · {{ statusLabel }}
      </span>
      <ElTooltip :content="locale.t('pages.new', 'New page')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
        <ElButton native-type="button" class="topbar-secondary-action" :aria-label="locale.t('pages.new', 'New page')" circle @click="emit('newPage')">
          <Plus :size="17" aria-hidden="true" />
        </ElButton>
      </ElTooltip>
      <ElTooltip v-if="project" :content="locale.t('save.menu', 'Save options')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
        <ElDropdown class="save-menu export-menu" trigger="click" placement="bottom-end" :show-timeout="0" :hide-timeout="0" append-to="#workbench-overlays" @command="chooseSaveAction">
          <ElButton ref="saveTrigger" native-type="button" :aria-label="locale.t('save.menu', 'Save options')" :disabled="!!configError || busy">
            <Save :size="16" aria-hidden="true" />
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
      </ElTooltip>
      <ElTooltip v-if="project" :content="locale.t('action.export', 'Export')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
        <ElDropdown class="export-menu" trigger="click" placement="bottom-end" :show-timeout="0" :hide-timeout="0" append-to="#workbench-overlays" @command="chooseExport">
          <ElButton ref="exportTrigger" native-type="button" :aria-label="locale.t('action.export', 'Export')">
            <Download :size="16" aria-hidden="true" />
            <ChevronDown class="export-chevron" :size="13" aria-hidden="true" />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu class="export-menu-popover" data-export-menu>
              <ElDropdownItem command="source"><Code2 :size="15" aria-hidden="true" /><span>{{ locale.t('export.source', 'Export source') }}</span></ElDropdownItem>
              <ElDropdownItem command="config"><Braces :size="15" aria-hidden="true" /><span>{{ locale.t('export.config', 'Export config') }}</span></ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </ElTooltip>
      <ElTooltip v-if="project" :content="locale.t('flow.dialog.title', 'Event flow orchestration')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
      <ElButton
        v-if="project"
        native-type="button"
        class="topbar-secondary-action"
        :class="{ 'is-active': flowOpen }"
        :aria-label="locale.t('flow.dialog.title', 'Event flow orchestration')"
        :aria-expanded="flowOpen"
        circle
        data-flow-workspace-trigger
        @click="emit('openFlow')"
      >
        <Workflow :size="17" aria-hidden="true" />
      </ElButton>
      </ElTooltip>
      <ElTooltip :content="localeId === 'zh-CN' ? locale.t('locale.switchToEnglish', 'Switch to English') : locale.t('locale.switchToChinese', 'Switch to Chinese')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
      <ElButton
        native-type="button"
        class="topbar-secondary-action"
        :aria-label="localeId === 'zh-CN' ? locale.t('locale.switchToEnglish', 'Switch to English') : locale.t('locale.switchToChinese', 'Switch to Chinese')"
        circle
        @click="emit('toggleLocale')"
      >
        <Languages :size="17" aria-hidden="true" />
      </ElButton>
      </ElTooltip>
      <ElTooltip :content="theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
      <ElButton native-type="button" class="topbar-secondary-action" :aria-label="theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme')" circle @click="emit('toggleTheme')">
        <Sun v-if="theme === 'dark'" :size="17" aria-hidden="true" />
        <Moon v-else :size="17" aria-hidden="true" />
      </ElButton>
      </ElTooltip>
      <ElTooltip v-if="project" :content="previewOpen ? locale.t('preview.hide', 'Hide preview') : locale.t('preview.show', 'Show preview')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
      <ElButton
        v-if="project"
        native-type="button"
        class="preview-toggle-button"
        :aria-label="previewOpen ? locale.t('preview.hide', 'Hide preview') : locale.t('preview.show', 'Show preview')"
        circle
        @click="emit('togglePreview')"
      >
        <PanelRightClose v-if="previewOpen" :size="17" aria-hidden="true" />
        <PanelRightOpen v-else :size="17" aria-hidden="true" />
      </ElButton>
      </ElTooltip>
      <ElTooltip :content="locale.t('workbench.moreActions', 'More actions')" placement="bottom" popper-class="workbench-passive-tooltip" append-to="#workbench-overlays">
        <ElDropdown class="mobile-action-menu" trigger="click" placement="bottom-end" :show-timeout="0" :hide-timeout="0" append-to="#workbench-overlays" @command="chooseMobileAction">
          <ElButton ref="mobileMenuTrigger" native-type="button" :aria-label="locale.t('workbench.moreActions', 'More actions')" circle><MoreHorizontal :size="18" aria-hidden="true" /></ElButton>
          <template #dropdown>
            <ElDropdownMenu class="mobile-action-popover" data-mobile-action-menu>
              <ElDropdownItem v-if="project" command="openPages"><Files :size="15" aria-hidden="true" /><span>{{ locale.t('pages.manage', 'Manage pages') }}</span></ElDropdownItem>
              <ElDropdownItem command="newPage"><Plus :size="15" aria-hidden="true" /><span>{{ locale.t('pages.new', 'New page') }}</span></ElDropdownItem>
              <ElDropdownItem command="save" :disabled="!dirty || !!configError || busy"><Save :size="15" aria-hidden="true" /><span>{{ locale.t('action.save', 'Save') }}</span></ElDropdownItem>
              <ElDropdownItem v-if="project" command="checkpoint" :disabled="!!configError || busy"><BookmarkPlus :size="15" aria-hidden="true" /><span>{{ locale.t('save.checkpoint', 'Create named checkpoint') }}</span></ElDropdownItem>
              <ElDropdownItem v-if="project" command="versions"><History :size="15" aria-hidden="true" /><span>{{ locale.t('save.history', 'Version history') }}</span></ElDropdownItem>
              <ElDropdownItem v-if="project" command="openFlow"><Workflow :size="15" aria-hidden="true" /><span>{{ locale.t('flow.dialog.title', 'Event flow orchestration') }}</span></ElDropdownItem>
              <ElDropdownItem command="toggleLocale"><Languages :size="15" aria-hidden="true" /><span>{{ localeId === 'zh-CN' ? locale.t('locale.switchToEnglish', 'Switch to English') : locale.t('locale.switchToChinese', 'Switch to Chinese') }}</span></ElDropdownItem>
              <ElDropdownItem command="toggleTheme"><Sun v-if="theme === 'dark'" :size="15" aria-hidden="true" /><Moon v-else :size="15" aria-hidden="true" /><span>{{ theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme') }}</span></ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </ElTooltip>
    </div>
  </header>
</template>
