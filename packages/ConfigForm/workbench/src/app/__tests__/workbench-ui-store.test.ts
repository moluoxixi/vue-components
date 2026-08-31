// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createWorkbenchUiStore } from '../workbench-ui-store'

describe('workbench UI store', () => {
  beforeEach(() => localStorage.clear())

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
})
