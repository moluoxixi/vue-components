import type { ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkbenchLocaleId } from '../locale'
import type { PreviewViewport } from '../studio/PreviewDrawer.vue'
import type { StudioLeftView } from '../studio/StudioLeftPanel.vue'
import { ref, shallowRef, watch } from 'vue'
import {
  readWorkbenchLocalePreference,
  resolveWorkbenchLocale,
  writeWorkbenchLocalePreference,
} from '../locale'

export type MobileStudioView = 'canvas' | 'components' | 'inspector' | 'layers' | 'pages'
export type WorkbenchTheme = 'dark' | 'light'

export interface WorkbenchUiStoreOptions {
  locale?: DesignerLocaleOptions
}

export interface WorkbenchNotice {
  readonly id: number
  readonly message: string
  readonly tone: 'error' | 'info' | 'success'
  readonly action?: {
    readonly label: string
    readonly run: () => void
  }
}

export interface ShowWorkbenchNoticeOptions {
  action?: {
    label: string
    run: () => void
  }
  durationMs?: number
  message: string
  tone?: WorkbenchNotice['tone']
}

function initialLocale(options: Readonly<WorkbenchUiStoreOptions>): WorkbenchLocaleId {
  if (options.locale?.locale)
    return resolveWorkbenchLocale(options.locale.locale)
  const persisted = readWorkbenchLocalePreference(
    typeof localStorage === 'undefined' ? undefined : localStorage,
  )
  if (persisted)
    return persisted
  return resolveWorkbenchLocale(typeof navigator === 'undefined' ? undefined : navigator.language)
}

export function createWorkbenchUiStore(options: Readonly<WorkbenchUiStoreOptions>) {
  const mobileStudioView = ref<MobileStudioView>('canvas')
  const studioLeftView = ref<StudioLeftView>('components')
  const previewOpen = ref(false)
  const previewExpanded = ref(false)
  const previewViewport = ref<PreviewViewport>('desktop')
  const templatePickerOpen = ref(false)
  const pageManagerOpen = ref(false)
  const pageManagerLoaded = ref(false)
  const exportPreviewMode = ref<'source' | 'config'>()
  const exportDialogLoaded = ref(false)
  const flowWorkspaceOpen = ref(false)
  const flowDialogLoaded = ref(false)
  const flowInitialTrigger = shallowRef<ConfigFormFlowTrigger>()
  const theme = ref<WorkbenchTheme>('dark')
  const localeId = ref<WorkbenchLocaleId>(initialLocale(options))
  const message = ref('')
  const notice = shallowRef<WorkbenchNotice>()
  let noticeSequence = 0
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  function notify(value: unknown): void {
    message.value = value instanceof Error ? value.message : String(value)
  }

  function clearMessage(): void {
    message.value = ''
  }

  function clearNotice(id?: number): void {
    if (id !== undefined && notice.value?.id !== id)
      return
    if (noticeTimer !== undefined)
      clearTimeout(noticeTimer)
    noticeTimer = undefined
    notice.value = undefined
  }

  function showNotice(options: ShowWorkbenchNoticeOptions): void {
    clearNotice()
    const id = ++noticeSequence
    let actionUsed = false
    notice.value = {
      id,
      message: options.message,
      tone: options.tone ?? 'info',
      ...(options.action
        ? {
            action: {
              label: options.action.label,
              run: () => {
                if (actionUsed || notice.value?.id !== id)
                  return
                actionUsed = true
                options.action?.run()
                clearNotice(id)
              },
            },
          }
        : {}),
    }
    const duration = options.durationMs ?? (options.action ? 8000 : 5000)
    if (duration > 0)
      noticeTimer = setTimeout(clearNotice, duration, id)
  }

  function closeExportPreview(): void {
    exportPreviewMode.value = undefined
  }

  function openExportPreview(mode: 'source' | 'config'): void {
    exportDialogLoaded.value = true
    exportPreviewMode.value = mode
  }

  function closeFlowWorkspace(): void {
    flowWorkspaceOpen.value = false
  }

  function openFlowWorkspace(trigger?: ConfigFormFlowTrigger): void {
    flowInitialTrigger.value = trigger
    flowDialogLoaded.value = true
    flowWorkspaceOpen.value = true
  }

  function closePageManager(): void {
    pageManagerOpen.value = false
  }

  function openPageManager(): void {
    pageManagerLoaded.value = true
    pageManagerOpen.value = true
  }

  function closeTemplatePicker(): void {
    templatePickerOpen.value = false
  }

  function openTemplatePicker(): void {
    templatePickerOpen.value = true
  }

  function openPageTemplatePicker(): void {
    closePageManager()
    openTemplatePicker()
  }

  function selectMobileStudioView(view: MobileStudioView): void {
    previewOpen.value = false
    previewExpanded.value = false
    mobileStudioView.value = view
    if (view === 'components' || view === 'layers' || view === 'pages')
      studioLeftView.value = view
  }

  function togglePreview(): void {
    previewOpen.value = !previewOpen.value
    if (!previewOpen.value)
      previewExpanded.value = false
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function toggleLocale(): void {
    localeId.value = localeId.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  }

  watch(localeId, (value) => {
    writeWorkbenchLocalePreference(
      value,
      typeof localStorage === 'undefined' ? undefined : localStorage,
    )
    if (typeof document !== 'undefined')
      document.documentElement.lang = value
  }, { immediate: true })

  watch(theme, (value) => {
    if (typeof document !== 'undefined')
      document.getElementById('workbench-overlays')?.setAttribute('data-theme', value)
  }, { immediate: true })

  watch(() => options.locale?.locale, (value) => {
    if (value)
      localeId.value = resolveWorkbenchLocale(value)
  })

  return {
    clearMessage,
    clearNotice,
    closeExportPreview,
    closeFlowWorkspace,
    closePageManager,
    closeTemplatePicker,
    exportDialogLoaded,
    exportPreviewMode,
    flowDialogLoaded,
    flowInitialTrigger,
    flowWorkspaceOpen,
    localeId,
    message,
    mobileStudioView,
    notice,
    notify,
    openExportPreview,
    openFlowWorkspace,
    openPageManager,
    openPageTemplatePicker,
    openTemplatePicker,
    pageManagerLoaded,
    pageManagerOpen,
    previewExpanded,
    previewOpen,
    previewViewport,
    selectMobileStudioView,
    showNotice,
    studioLeftView,
    templatePickerOpen,
    theme,
    toggleLocale,
    togglePreview,
    toggleTheme,
  }
}

export type WorkbenchUiStore = ReturnType<typeof createWorkbenchUiStore>
