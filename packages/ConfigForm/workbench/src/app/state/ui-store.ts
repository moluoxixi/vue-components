import type { ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { WorkbenchLocaleId } from '../../locale'
import type { PreviewViewport, StudioLeftView } from '../../studio'
import type {
  MobileStudioView,
  ShowWorkbenchNoticeOptions,
  WorkbenchNotice,
  WorkbenchPaletteFamily,
  WorkbenchThemePreference,
  WorkbenchUiStoreOptions,
} from '../types'
import { computed, ref, shallowRef, watch } from 'vue'
import {
  readWorkbenchLocalePreference,
  resolveWorkbenchLocale,
  writeWorkbenchLocalePreference,
} from '../../locale'
import { WORKBENCH_APPEARANCE_VERSION } from '../constants'
import {
  readWorkbenchAppearancePreference,
  resolveWorkbenchAppearanceStorage,
  resolveWorkbenchTheme,
  writeWorkbenchAppearancePreference,
} from '../services'

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
  const appearance = readWorkbenchAppearancePreference(resolveWorkbenchAppearanceStorage())
  const mobileStudioView = ref<MobileStudioView>('canvas')
  const studioLeftView = ref<StudioLeftView>('components')
  const previewOpen = ref(false)
  const previewExpanded = ref(false)
  const previewViewport = ref<PreviewViewport>('desktop')
  const pageManagerOpen = ref(false)
  const pageManagerLoaded = ref(false)
  const exportPreviewMode = ref<'source' | 'config'>()
  const exportDialogLoaded = ref(false)
  const flowWorkspaceOpen = ref(false)
  const flowDialogLoaded = ref(false)
  const flowInitialTrigger = shallowRef<ConfigFormFlowTrigger>()
  const appearanceDrawerOpen = ref(false)
  const themePreference = ref<WorkbenchThemePreference>(appearance.themePreference)
  const paletteFamily = ref<WorkbenchPaletteFamily>(appearance.paletteFamily)
  const systemPrefersDark = ref(false)
  const resolvedTheme = computed(() => resolveWorkbenchTheme(themePreference.value, systemPrefersDark.value))
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

  function closeAppearanceDrawer(): void {
    appearanceDrawerOpen.value = false
  }

  function openAppearanceDrawer(): void {
    appearanceDrawerOpen.value = true
  }

  function setPaletteFamily(value: WorkbenchPaletteFamily): void {
    paletteFamily.value = value
  }

  function setThemePreference(value: WorkbenchThemePreference): void {
    themePreference.value = value
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

  watch(themePreference, (value, _previous, onCleanup) => {
    if (value !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function')
      return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = (event: Pick<MediaQueryListEvent, 'matches'> | MediaQueryList): void => {
      systemPrefersDark.value = event.matches
    }
    syncSystemTheme(query)
    query.addEventListener('change', syncSystemTheme)
    onCleanup(() => query.removeEventListener('change', syncSystemTheme))
  }, { immediate: true })

  watch([themePreference, paletteFamily], ([nextThemePreference, nextPaletteFamily]) => {
    writeWorkbenchAppearancePreference({
      version: WORKBENCH_APPEARANCE_VERSION,
      themePreference: nextThemePreference,
      paletteFamily: nextPaletteFamily,
    }, resolveWorkbenchAppearanceStorage())
  }, { immediate: true })

  watch([resolvedTheme, paletteFamily], ([nextTheme, nextPaletteFamily]) => {
    if (typeof document === 'undefined')
      return
    document.documentElement.setAttribute('data-theme', nextTheme)
    document.documentElement.setAttribute('data-palette', nextPaletteFamily)
    const overlay = document.getElementById('workbench-overlays')
    overlay?.setAttribute('data-theme', nextTheme)
    overlay?.setAttribute('data-palette', nextPaletteFamily)
  }, { immediate: true })

  watch(() => options.locale?.locale, (value) => {
    if (value)
      localeId.value = resolveWorkbenchLocale(value)
  })

  return {
    appearanceDrawerOpen,
    clearMessage,
    closeAppearanceDrawer,
    clearNotice,
    closeExportPreview,
    closeFlowWorkspace,
    closePageManager,
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
    openAppearanceDrawer,
    openExportPreview,
    openFlowWorkspace,
    openPageManager,
    pageManagerLoaded,
    pageManagerOpen,
    paletteFamily,
    previewExpanded,
    previewOpen,
    previewViewport,
    resolvedTheme,
    selectMobileStudioView,
    setPaletteFamily,
    setThemePreference,
    showNotice,
    studioLeftView,
    themePreference,
    toggleLocale,
    togglePreview,
  }
}
