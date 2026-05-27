import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const viewerPauseMs = 350
const dialogPauseMs = 800
const searchButtonName = /^搜\s*索$/
const submitButtonName = /^提\s*交$/

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

async function expectFieldError(panel: Locator, message: string) {
  await expect(panel.getByText(message, { exact: true }).first()).toBeVisible()
}

async function expectFieldErrorGone(panel: Locator, message: string) {
  await expect(panel.getByText(message, { exact: true })).toHaveCount(0)
}

function fieldControl(panel: Locator, label: string): Locator {
  return panel
    .locator('.moluoxixi-field')
    .filter({ hasText: label })
    .first()
    .locator('.moluoxixi-field__control')
}

test.describe('playground 交互演示', () => {
  test('可以逐个打开主要示例页签', async ({ page }) => {
    await openPlayground(page)

    for (const { name, expectedText } of [
      { name: /Grid 模式/, expectedText: /用户名/ },
      { name: /Inline 模式/, expectedText: /关键词/ },
      { name: /只读模式/, expectedText: /提交值快照/ },
      { name: /Card 嵌套 Checkbox/, expectedText: /权限范围/ },
      { name: /嵌套布局 FormLayout/, expectedText: /提交值快照/ },
      { name: /多 Form Card/, expectedText: /账户信息 Form/ },
      { name: /Vue I18n 表单/, expectedText: /提交值快照/ },
    ]) {
      await openTab(page, name)
      await expect(activePanel(page)).toContainText(expectedText)
    }
  })

  test('Grid 表单可以输入边界文本并触发条件字段', async ({ page }) => {
    await openPlayground(page)

    const panel = activePanel(page)
    const maxUsername = 'abcdefghijklmnopqrst'
    const maxBio = 'A'.repeat(200)

    // 20 字符命中 username schema 的上边界，验证最大合法长度仍可交互写入。
    await panel.getByPlaceholder('请输入用户名').fill(maxUsername)
    await expect(panel.getByPlaceholder('请输入用户名')).toHaveValue(maxUsername)
    await pauseForViewer(page)
    await panel.getByPlaceholder('请输入密码').fill('demo-secret')
    await expect(panel.getByPlaceholder('请输入密码')).toHaveValue('demo-secret')
    await pauseForViewer(page)
    await expect(panel.getByPlaceholder('请说明您的性别')).toBeHidden()
    await panel.locator('label').filter({ hasText: '其他' }).click()
    await expect(panel.getByPlaceholder('请说明您的性别')).toBeVisible()
    await panel.getByPlaceholder('请说明您的性别').fill('边界值/其他')
    await pauseForViewer(page)
    await panel.getByPlaceholder('请输入个人简介').fill(maxBio)
    await expect(panel.getByPlaceholder('请说明您的性别')).toHaveValue('边界值/其他')
    await expect(panel.getByPlaceholder('请输入个人简介')).toHaveValue(maxBio)
    await panel.locator('label').filter({ hasText: /^男$/ }).click()
    await expect(panel.getByPlaceholder('请说明您的性别')).toBeHidden()
    const activeSwitch = fieldControl(panel, '启用状态')

    await expect(activeSwitch.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await activeSwitch.locator('.el-switch, .ant-switch').click()
    await expect(activeSwitch.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    await expect(panel.getByPlaceholder('请输入用户名')).toBeHidden()
    await expect(panel.getByPlaceholder('请输入密码')).toBeHidden()
    await expect(panel.getByPlaceholder('选择生效日期')).toBeHidden()
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

  test('Inline 表单会拦截空关键词并提交特殊字符关键词', async ({ page }) => {
    await openPlayground(page)
    await openTab(page, /Inline 模式/)

    const panel = activePanel(page)
    const keyword = '边界-Key_123!@#[]'
    const keywordInput = panel.getByPlaceholder('搜索...')

    await panel.getByRole('button', { name: searchButtonName }).click()
    await expectFieldError(panel, 'Required')
    await expect(panel.locator('.value-preview')).not.toContainText('"keyword"')

    await keywordInput.fill(keyword)
    await expect(keywordInput).toHaveValue(keyword)
    await pauseForViewer(page)

    const message = await submitWithAlert(panel.getByRole('button', { name: searchButtonName }), '搜索提交！')

    expect(message).toContain(`"keyword": "${keyword}"`)
    await expect(panel.locator('.value-preview')).toContainText(`"keyword": "${keyword}"`)
    await expectFieldErrorGone(panel, 'Required')
  })

  test('I18n 表单可以切换英文、断言最小长度边界并提交英文反馈', async ({ page }) => {
    await openPlayground(page)
    await openTab(page, /Vue I18n 表单/)

    const panel = activePanel(page)

    await panel.getByRole('button', { name: /切换到 English/ }).click()
    await expect(panel.getByPlaceholder('Enter username')).toBeVisible()
    await pauseForViewer(page)
    await panel.getByPlaceholder('Enter username').fill('a')
    await panel.getByPlaceholder('Enter username').blur()
    await expectFieldError(panel, 'Username must be at least 2 characters')
    await panel.getByPlaceholder('Enter username').fill('al')
    await expect(panel.getByPlaceholder('Enter username')).toHaveValue('al')
    await pauseForViewer(page)

    const message = await submitWithAlert(panel.getByRole('button', { name: /^Submit$/ }), 'Submitted!')

    expect(message).toContain('"username": "al"')
    await expect(panel.locator('.value-preview')).toContainText('"username": "al"')
    await expectFieldErrorGone(panel, 'Username must be at least 2 characters')
    await panel.getByRole('button', { name: /Switch to 中文/ }).click()
    await expect(panel.getByPlaceholder('请输入用户名')).toBeVisible()
    await expect(panel.locator('.value-preview')).toContainText('"username": "al"')
  })

  test('嵌套 Checkbox 会断言空选择边界和提交值范围', async ({ page }) => {
    await openPlayground(page)
    await openTab(page, /Card 嵌套 Checkbox/)

    const panel = activePanel(page)

    await panel.getByRole('button', { name: submitButtonName }).click()
    await expectFieldError(panel, '请至少选择一个权限范围')
    await expect(panel.locator('.value-preview')).not.toContainText('"permissionScopes"')

    await panel.locator('label').filter({ hasText: '读取数据' }).click()
    await panel.locator('label').filter({ hasText: '发布配置' }).click()

    const message = await submitWithAlert(panel.getByRole('button', { name: submitButtonName }), '"permissionScopes"')

    expect(message).toContain('"read"')
    expect(message).toContain('"publish"')
    expect(message).not.toContain('外层 Card 容器')
    expect(message).not.toContain('内层 Card 容器')
    await expect(panel.locator('.value-preview')).toContainText('"permissionScopes"')
    await expect(panel.locator('.value-preview')).toContainText('"read"')
    await expect(panel.locator('.value-preview')).toContainText('"publish"')
  })
})
