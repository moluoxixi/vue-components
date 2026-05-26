import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const viewerPauseMs = 350
const dialogPauseMs = 800
const searchButtonName = /^搜\s*索$/

function activePanel(page: Page): Locator {
  return page.locator('[role="tabpanel"]:not([aria-hidden="true"])').last()
}

async function pauseForViewer(page: Page) {
  await page.waitForTimeout(viewerPauseMs)
}

async function holdDialogForViewer() {
  await new Promise(resolve => setTimeout(resolve, dialogPauseMs))
}

async function openPlayground(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('tab', { name: /Grid 模式/ })).toBeVisible()
  await expect(activePanel(page)).toBeVisible()
  await pauseForViewer(page)
}

async function openTab(page: Page, name: RegExp) {
  const tab = page.getByRole('tab', { name })

  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(activePanel(page)).toBeVisible()
  await pauseForViewer(page)
}

async function readInlineLayoutMetrics(page: Page) {
  return activePanel(page).evaluate((panel) => {
    const form = panel.querySelector<HTMLElement>('.moluoxixi-form')!
    const formStyle = getComputedStyle(form)

    return {
      formAlignItems: formStyle.alignItems,
      formDisplay: formStyle.display,
      formFlexWrap: formStyle.flexWrap,
      fields: Array.from(panel.querySelectorAll<HTMLElement>('.moluoxixi-field--inline')).map((field) => {
        const label = field.querySelector<HTMLElement>('.moluoxixi-field__label')!
        const control = field.querySelector<HTMLElement>('.moluoxixi-field__control')!
        const labelRect = label.getBoundingClientRect()
        const controlRect = control.getBoundingClientRect()
        const fieldStyle = getComputedStyle(field)
        const labelStyle = getComputedStyle(label)
        const controlStyle = getComputedStyle(control)

        return {
          controlPaddingBottom: controlStyle.paddingBottom,
          controlTop: Math.round(controlRect.y),
          fieldAlignItems: fieldStyle.alignItems,
          fieldDisplay: fieldStyle.display,
          labelInlineWidth: label.style.width,
          labelLineHeight: labelStyle.lineHeight,
          labelTop: Math.round(labelRect.y),
        }
      }),
    }
  })
}

async function readReadonlyLabelMetrics(page: Page) {
  return activePanel(page).evaluate(panel =>
    Array.from(panel.querySelectorAll<HTMLElement>('.moluoxixi-field')).map((field) => {
      const label = field.querySelector<HTMLElement>('.moluoxixi-field__label')!
      const control = field.querySelector<HTMLElement>('.moluoxixi-field__control')!
      const readonly = field.querySelector<HTMLElement>('.moluoxixi-field__readonly')!
      const labelRect = label.getBoundingClientRect()
      const controlRect = control.getBoundingClientRect()
      const readonlyRect = readonly.getBoundingClientRect()
      const fieldStyle = getComputedStyle(field)
      const controlStyle = getComputedStyle(control)

      return {
        alignItems: fieldStyle.alignItems,
        controlPaddingBottom: controlStyle.paddingBottom,
        controlTop: Math.round(controlRect.y),
        controlX: Math.round(controlRect.x),
        display: fieldStyle.display,
        errorCount: field.querySelectorAll('.moluoxixi-field__error').length,
        labelWidth: Math.round(labelRect.width),
        labelTop: Math.round(labelRect.y),
        labelX: Math.round(labelRect.x),
        readonlyHeight: Math.round(readonlyRect.height),
      }
    }),
  )
}

async function submitWithAlert(trigger: Locator, expectedMessage: string) {
  const dialogPromise = new Promise<string>((resolve) => {
    trigger.page().once('dialog', async (dialog) => {
      const message = dialog.message()

      expect(message).toContain(expectedMessage)
      await holdDialogForViewer()
      await dialog.accept()
      resolve(message)
    })
  })

  await trigger.click()
  return dialogPromise
}

test.describe('playground 交互演示', () => {
  test('可以逐个打开主要示例页签', async ({ page }) => {
    await openPlayground(page)

    for (const name of [
      /Grid 模式/,
      /Inline 模式/,
      /只读模式/,
      /Card 嵌套 Checkbox/,
      /嵌套布局 FormLayout/,
      /多 Form Card/,
      /Vue I18n 表单/,
    ]) {
      await openTab(page, name)
    }
  })

  test('Grid 表单可以输入文本并触发条件字段', async ({ page }) => {
    await openPlayground(page)

    const panel = activePanel(page)

    await panel.getByPlaceholder('请输入用户名').fill('demo-user')
    await pauseForViewer(page)
    await panel.getByPlaceholder('请输入密码').fill('demo-secret')
    await pauseForViewer(page)
    await panel.locator('label').filter({ hasText: '其他' }).click()
    await expect(panel.getByPlaceholder('请说明您的性别')).toBeVisible()
    await panel.getByPlaceholder('请说明您的性别').fill('playground-visible')
    await pauseForViewer(page)
    await panel.getByPlaceholder('请输入个人简介').fill('Playwright headed interaction demo')
    await expect(panel.getByPlaceholder('请说明您的性别')).toHaveValue('playground-visible')
  })

  test('Inline 表单外层换行且字段内部沿用 grid 的副轴布局', async ({ page }) => {
    await openPlayground(page)
    await openTab(page, /Inline 模式/)

    const metrics = await readInlineLayoutMetrics(page)

    expect(metrics.formDisplay).toBe('flex')
    expect(metrics.formFlexWrap).toBe('wrap')
    expect(metrics.formAlignItems).toBe('flex-start')
    expect(metrics.fields.length).toBeGreaterThan(0)
    expect(metrics.fields.every(metric => metric.fieldDisplay === 'flex')).toBe(true)
    expect(metrics.fields.every(metric => metric.fieldAlignItems === 'flex-start')).toBe(true)
    expect(metrics.fields.every(metric => metric.labelInlineWidth === '')).toBe(true)
    expect(metrics.fields.every(metric => metric.labelLineHeight === '32px')).toBe(true)
    expect(metrics.fields.every(metric => metric.controlPaddingBottom !== '0px')).toBe(true)
    expect(metrics.fields.every(metric => Math.abs(metric.labelTop - metric.controlTop) <= 1)).toBe(true)
  })

  test('Readonly 表单沿用 FormItem 布局壳', async ({ page }) => {
    await openPlayground(page)
    await openTab(page, /只读模式/)

    const metrics = await readReadonlyLabelMetrics(page)

    expect(metrics.length).toBeGreaterThan(0)
    expect(metrics.every(metric => metric.display === 'flex')).toBe(true)
    expect(metrics.every(metric => metric.alignItems === 'flex-start')).toBe(true)
    expect(metrics.every(metric => metric.labelWidth === 96)).toBe(true)
    expect(metrics.every(metric => metric.controlX > metric.labelX)).toBe(true)
    expect(metrics.every(metric => metric.controlPaddingBottom !== '0px')).toBe(true)
    expect(metrics.every(metric => metric.errorCount === 1)).toBe(true)
    expect(metrics.every(metric => metric.readonlyHeight >= 32)).toBe(true)
    expect(metrics.every(metric => Math.abs(metric.labelTop - metric.controlTop) <= 1)).toBe(true)
  })

  test('Inline 表单可以搜索提交并更新快照', async ({ page }) => {
    await openPlayground(page)
    await openTab(page, /Inline 模式/)

    const panel = activePanel(page)

    await panel.getByPlaceholder('搜索...').fill('config-form')
    await pauseForViewer(page)

    const message = await submitWithAlert(panel.getByRole('button', { name: searchButtonName }), '搜索提交！')

    expect(message).toContain('"keyword": "config-form"')
    await expect(panel.locator('.value-preview')).toContainText('"keyword": "config-form"')
  })

  test('I18n 表单可以切换英文并提交英文反馈', async ({ page }) => {
    await openPlayground(page)
    await openTab(page, /Vue I18n 表单/)

    const panel = activePanel(page)

    await panel.getByRole('button', { name: /切换到 English/ }).click()
    await expect(panel.getByPlaceholder('Enter username')).toBeVisible()
    await pauseForViewer(page)
    await panel.getByPlaceholder('Enter username').fill('alice')
    await pauseForViewer(page)

    const message = await submitWithAlert(panel.getByRole('button', { name: /^Submit$/ }), 'Submitted!')

    expect(message).toContain('"username": "alice"')
    await expect(panel.locator('.value-preview')).toContainText('"username": "alice"')
  })
})
