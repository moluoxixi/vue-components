// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createWorkbenchUiStore } from '../workbench-ui-store'

describe('workbench UI store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="workbench-overlays" data-theme="dark"></div>'
  })
  afterEach(() => vi.useRealTimers())

  it('owns dialog, preview, mobile navigation, theme, locale, and message state', async () => {
    const ui = createWorkbenchUiStore({ locale: { locale: 'en-US' } })

    ui.openExportPreview('source')
    ui.openFlowWorkspace({ kind: 'page.mount' })
    ui.openPageManager()
    ui.notify('Saved')
    ui.togglePreview()
    ui.toggleTheme()
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
    expect(ui.theme.value).toBe('light')
    expect(document.getElementById('workbench-overlays')?.dataset.theme).toBe('light')
    expect(ui.localeId.value).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('closes preview expansion and page manager through explicit UI operations', () => {
    const ui = createWorkbenchUiStore({})
    ui.togglePreview()
    ui.previewExpanded.value = true
    ui.togglePreview()
    ui.openPageManager()
    ui.openPageTemplatePicker()

    expect(ui.previewOpen.value).toBe(false)
    expect(ui.previewExpanded.value).toBe(false)
    expect(ui.pageManagerOpen.value).toBe(false)
    expect(ui.templatePickerOpen.value).toBe(true)
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
