// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createWorkbenchUiStore } from '..'

function installColorScheme(initiallyDark = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  let matches = initiallyDark
  const query = {
    get matches() { return matches },
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatch(nextMatches: boolean) {
      matches = nextMatches
      listeners.forEach(listener => listener({ matches } as MediaQueryListEvent))
    },
  }
  vi.stubGlobal('matchMedia', vi.fn(() => query))
  return query
}

describe('workbench UI store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="workbench-overlays" data-theme="dark"></div>'
    installColorScheme(false)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('owns dialog, preview, mobile navigation, theme, locale, and message state', async () => {
    const ui = createWorkbenchUiStore({ locale: { locale: 'en-US' } })

    ui.openExportPreview('source')
    ui.openFlowWorkspace({ kind: 'page.mount' })
    ui.openPageManager()
    ui.notify('Saved')
    ui.togglePreview()
    ui.setThemePreference('dark')
    ui.setPaletteFamily('kanagawa')
    ui.toggleLocale()
    ui.selectMobileStudioView('pages')
    await nextTick()

    expect(ui.exportDialogLoaded.value).toBe(true)
    expect(ui.exportPreviewMode.value).toBe('source')
    expect(ui.flowDialogLoaded.value).toBe(true)
    expect(ui.flowInitialTrigger.value).toEqual({ kind: 'page.mount' })
    expect(ui.pageManagerLoaded.value).toBe(true)
    expect(ui.pageManagerOpen.value).toBe(true)
    expect(ui.message.value).toBe('Saved')
    expect(ui.previewOpen.value).toBe(false)
    expect(ui.mobileStudioView.value).toBe('pages')
    expect(ui.studioLeftView.value).toBe('pages')
    expect(ui.themePreference.value).toBe('dark')
    expect(ui.resolvedTheme.value).toBe('dark')
    expect(ui.paletteFamily.value).toBe('kanagawa')
    expect(document.getElementById('workbench-overlays')?.dataset.theme).toBe('dark')
    expect(document.getElementById('workbench-overlays')?.dataset.palette).toBe('kanagawa')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.palette).toBe('kanagawa')
    expect(ui.localeId.value).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('tracks the system scheme only while system mode is selected', async () => {
    const query = installColorScheme(false)
    const ui = createWorkbenchUiStore({})
    expect(ui.resolvedTheme.value).toBe('light')
    expect(query.addEventListener).toHaveBeenCalledOnce()

    query.dispatch(true)
    await nextTick()
    expect(ui.resolvedTheme.value).toBe('dark')

    ui.setThemePreference('light')
    await nextTick()
    expect(query.removeEventListener).toHaveBeenCalledOnce()
    query.dispatch(true)
    expect(ui.resolvedTheme.value).toBe('light')
  })

  it('restores and persists application appearance outside project state', async () => {
    localStorage.setItem('moluoxixi.config-form.workbench.appearance', JSON.stringify({
      version: 1,
      themePreference: 'dark',
      paletteFamily: 'rose-pine',
    }))
    const ui = createWorkbenchUiStore({})
    expect(ui.themePreference.value).toBe('dark')
    expect(ui.paletteFamily.value).toBe('rose-pine')

    ui.setThemePreference('system')
    ui.setPaletteFamily('gruvbox')
    await nextTick()
    expect(JSON.parse(localStorage.getItem('moluoxixi.config-form.workbench.appearance')!)).toEqual({
      version: 1,
      themePreference: 'system',
      paletteFamily: 'gruvbox',
    })
  })

  it('closes preview expansion and page manager through explicit UI operations', () => {
    const ui = createWorkbenchUiStore({})
    ui.togglePreview()
    ui.previewExpanded.value = true
    ui.togglePreview()
    ui.openPageManager()
    ui.closePageManager()

    expect(ui.previewOpen.value).toBe(false)
    expect(ui.previewExpanded.value).toBe(false)
    expect(ui.pageManagerOpen.value).toBe(false)
  })

  it('publishes a one-shot actionable notice without turning it into document state', () => {
    const ui = createWorkbenchUiStore({})
    const firstAction = vi.fn()
    ui.showNotice({
      action: { label: 'Undo', run: firstAction },
      durationMs: 0,
      message: 'Deleted',
      tone: 'success',
    })
    const first = ui.notice.value!
    first.action?.run()
    first.action?.run()

    expect(firstAction).toHaveBeenCalledOnce()
    expect(ui.notice.value).toBeUndefined()

    ui.showNotice({ action: { label: 'Undo', run: firstAction }, durationMs: 0, message: 'First' })
    const staleAction = ui.notice.value?.action
    ui.showNotice({ durationMs: 0, message: 'Second' })
    staleAction?.run()
    expect(firstAction).toHaveBeenCalledOnce()
    expect(ui.notice.value?.message).toBe('Second')
  })

  it('expires only the currently scheduled notice', () => {
    vi.useFakeTimers()
    const ui = createWorkbenchUiStore({})

    ui.showNotice({ durationMs: 100, message: 'First' })
    vi.advanceTimersByTime(50)
    ui.showNotice({ durationMs: 100, message: 'Second' })
    vi.advanceTimersByTime(50)
    expect(ui.notice.value?.message).toBe('Second')

    vi.advanceTimersByTime(50)
    expect(ui.notice.value).toBeUndefined()
  })
})
