<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkspaceApplication } from '../project'
import type { WorkbenchLocaleId } from '../locale'
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
  Save,
  Sun,
  Workflow,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

export type WorkbenchTheme = 'dark' | 'light'
export type WorkbenchExportMode = 'source' | 'config'

const props = defineProps<{
  application?: WorkspaceApplication
  busy?: boolean
  configError?: string
  currentPage?: WorkspaceApplication['pages'][number]
  dirty?: boolean
  flowOpen?: boolean
  locale?: DesignerLocaleOptions
  localeId: WorkbenchLocaleId
  previewOpen?: boolean
  statusLabel: string
  theme: WorkbenchTheme
}>()

const emit = defineEmits<{
  export: [mode: WorkbenchExportMode]
  newPage: []
  openFlow: []
  openPages: []
  save: []
  toggleLocale: []
  togglePreview: []
  toggleTheme: []
}>()

const root = useTemplateRef<HTMLElement>('root')
const exportTrigger = useTemplateRef<HTMLButtonElement>('exportTrigger')
const exportMenu = useTemplateRef<HTMLElement>('exportMenu')
const mobileMenuTrigger = useTemplateRef<HTMLButtonElement>('mobileMenuTrigger')
const mobileMenu = useTemplateRef<HTMLElement>('mobileMenu')
const exportMenuOpen = ref(false)
const mobileMenuOpen = ref(false)
const locale = computed(() => createDesignerLocale(props.locale))

function closeExportMenu(restoreFocus = false): void {
  if (!exportMenuOpen.value)
    return
  exportMenuOpen.value = false
  if (restoreFocus)
    void nextTick(() => exportTrigger.value?.focus())
}

function toggleExportMenu(): void {
  closeMobileMenu()
  exportMenuOpen.value = !exportMenuOpen.value
  if (exportMenuOpen.value) {
    void nextTick(() => exportMenu.value
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus())
  }
}

function closeMobileMenu(restoreFocus = false): void {
  if (!mobileMenuOpen.value)
    return
  mobileMenuOpen.value = false
  if (restoreFocus)
    void nextTick(() => mobileMenuTrigger.value?.focus())
}

function toggleMobileMenu(): void {
  closeExportMenu()
  mobileMenuOpen.value = !mobileMenuOpen.value
  if (mobileMenuOpen.value) {
    void nextTick(() => mobileMenu.value
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus())
  }
}

type MobileAction = 'newPage' | 'openFlow' | 'openPages' | 'save' | 'toggleLocale' | 'toggleTheme'

function chooseMobileAction(action: MobileAction): void {
  closeMobileMenu()
  mobileMenuTrigger.value?.focus()
  switch (action) {
    case 'newPage': emit('newPage'); break
    case 'openFlow': emit('openFlow'); break
    case 'openPages': emit('openPages'); break
    case 'save': emit('save'); break
    case 'toggleLocale': emit('toggleLocale'); break
    case 'toggleTheme': emit('toggleTheme'); break
  }
}

function chooseExport(mode: WorkbenchExportMode): void {
  closeExportMenu()
  exportTrigger.value?.focus()
  emit('export', mode)
}

function handleExportMenuKeydown(event: KeyboardEvent): void {
  const items = [...(exportMenu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
  if (event.key === 'Escape') {
    event.preventDefault()
    closeExportMenu(true)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || items.length === 0)
    return
  event.preventDefault()
  const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? items.length - 1
      : event.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length
  items[next]?.focus()
}

function handleMobileMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMobileMenu(true)
    return
  }
  const items = [...(mobileMenu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || items.length === 0)
    return
  event.preventDefault()
  const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? items.length - 1
      : event.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length
  items[next]?.focus()
}

function handleDocumentPointerdown(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) {
    closeExportMenu()
    closeMobileMenu()
  }
}

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerdown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerdown))
</script>

<template>
  <header ref="root" class="workbench-topbar">
    <div class="brand-lockup">
      <span>ConfigForm</span>
      <strong>Workbench</strong>
    </div>

    <div v-if="application && currentPage" class="workspace-context" :aria-label="locale.t('workbench.context', 'Current application and page')">
      <span>{{ application.name }}</span>
      <strong>{{ currentPage.name }}</strong>
    </div>

    <div class="topbar-actions">
      <button
        v-if="application"
        type="button"
        class="mobile-page-manager-button"
        :title="locale.t('pages.manage', 'Manage pages')"
        :aria-label="locale.t('pages.manage', 'Manage pages')"
        @click="emit('openPages')"
      >
        <Files :size="17" aria-hidden="true" />
      </button>
      <span v-if="application" class="revision-state" :class="{ 'is-dirty': dirty }">
        r{{ application.revision }} · {{ statusLabel }}
      </span>
      <button type="button" class="topbar-secondary-action" :title="locale.t('pages.new', 'New page')" :aria-label="locale.t('pages.new', 'New page')" @click="emit('newPage')">
        <Plus :size="17" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="topbar-secondary-action"
        :title="locale.t('action.save', 'Save')"
        :aria-label="locale.t('action.save', 'Save')"
        :disabled="!dirty || !!configError || busy"
        @click="emit('save')"
      >
        <Save :size="17" aria-hidden="true" />
      </button>
      <div v-if="application" class="export-menu">
        <button
          ref="exportTrigger"
          type="button"
          :title="locale.t('action.export', 'Export')"
          :aria-label="locale.t('action.export', 'Export')"
          :aria-expanded="exportMenuOpen"
          aria-haspopup="menu"
          @click="toggleExportMenu"
          @keydown.down.prevent="toggleExportMenu"
        >
          <Download :size="16" aria-hidden="true" />
          <ChevronDown class="export-chevron" :size="13" aria-hidden="true" />
        </button>
        <div v-if="exportMenuOpen" ref="exportMenu" class="export-menu-popover" role="menu" @keydown="handleExportMenuKeydown">
          <button type="button" role="menuitem" @click="chooseExport('source')">
            <Code2 :size="15" aria-hidden="true" />
            <span>{{ locale.t('export.source', 'Export source') }}</span>
          </button>
          <button type="button" role="menuitem" @click="chooseExport('config')">
            <Braces :size="15" aria-hidden="true" />
            <span>{{ locale.t('export.config', 'Export config') }}</span>
          </button>
        </div>
      </div>
      <button
        v-if="application"
        type="button"
        class="topbar-secondary-action"
        :class="{ 'is-active': flowOpen }"
        :title="locale.t('flow.dialog.title', 'Flow orchestration')"
        :aria-label="locale.t('flow.dialog.title', 'Flow orchestration')"
        :aria-expanded="flowOpen"
        data-flow-workspace-trigger
        @click="emit('openFlow')"
      >
        <Workflow :size="17" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="topbar-secondary-action"
        :title="localeId === 'zh-CN' ? locale.t('locale.switchToEnglish', 'Switch to English') : locale.t('locale.switchToChinese', 'Switch to Chinese')"
        :aria-label="localeId === 'zh-CN' ? locale.t('locale.switchToEnglish', 'Switch to English') : locale.t('locale.switchToChinese', 'Switch to Chinese')"
        @click="emit('toggleLocale')"
      >
        <Languages :size="17" aria-hidden="true" />
      </button>
      <button type="button" class="topbar-secondary-action" :title="theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme')" :aria-label="theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme')" @click="emit('toggleTheme')">
        <Sun v-if="theme === 'dark'" :size="17" aria-hidden="true" />
        <Moon v-else :size="17" aria-hidden="true" />
      </button>
      <button
        v-if="application"
        type="button"
        class="preview-toggle-button"
        :title="previewOpen ? locale.t('preview.hide', 'Hide preview') : locale.t('preview.show', 'Show preview')"
        :aria-label="previewOpen ? locale.t('preview.hide', 'Hide preview') : locale.t('preview.show', 'Show preview')"
        @click="emit('togglePreview')"
      >
        <PanelRightClose v-if="previewOpen" :size="17" aria-hidden="true" />
        <PanelRightOpen v-else :size="17" aria-hidden="true" />
      </button>
      <div class="mobile-action-menu">
        <button
          ref="mobileMenuTrigger"
          type="button"
          :title="locale.t('workbench.moreActions', 'More actions')"
          :aria-label="locale.t('workbench.moreActions', 'More actions')"
          :aria-expanded="mobileMenuOpen"
          aria-haspopup="menu"
          @click="toggleMobileMenu"
        >
          <MoreHorizontal :size="18" aria-hidden="true" />
        </button>
        <div v-if="mobileMenuOpen" ref="mobileMenu" class="mobile-action-popover" role="menu" @keydown="handleMobileMenuKeydown">
          <button v-if="application" type="button" role="menuitem" @click="chooseMobileAction('openPages')"><Files :size="15" aria-hidden="true" /><span>{{ locale.t('pages.manage', 'Manage pages') }}</span></button>
          <button type="button" role="menuitem" @click="chooseMobileAction('newPage')"><Plus :size="15" aria-hidden="true" /><span>{{ locale.t('pages.new', 'New page') }}</span></button>
          <button type="button" role="menuitem" :disabled="!dirty || !!configError || busy" @click="chooseMobileAction('save')"><Save :size="15" aria-hidden="true" /><span>{{ locale.t('action.save', 'Save') }}</span></button>
          <button v-if="application" type="button" role="menuitem" @click="chooseMobileAction('openFlow')"><Workflow :size="15" aria-hidden="true" /><span>{{ locale.t('flow.dialog.title', 'Flow orchestration') }}</span></button>
          <button type="button" role="menuitem" @click="chooseMobileAction('toggleLocale')"><Languages :size="15" aria-hidden="true" /><span>{{ localeId === 'zh-CN' ? locale.t('locale.switchToEnglish', 'Switch to English') : locale.t('locale.switchToChinese', 'Switch to Chinese') }}</span></button>
          <button type="button" role="menuitem" @click="chooseMobileAction('toggleTheme')"><Sun v-if="theme === 'dark'" :size="15" aria-hidden="true" /><Moon v-else :size="15" aria-hidden="true" /><span>{{ theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme') }}</span></button>
        </div>
      </div>
    </div>
  </header>
</template>
