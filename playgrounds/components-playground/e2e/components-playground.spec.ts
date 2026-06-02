import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

async function openComponent(page: Page, name: string): Promise<void> {
  await page.getByRole('menuitem', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

async function openDateRangePopover(page: Page): Promise<Locator> {
  const dateInput = page.getByRole('combobox', { name: '日期范围' })

  await dateInput.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  return page.getByRole('dialog')
}

async function openPlayground(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('menuitem', { name: 'DateRangePicker', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'ElementConfigForm', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'antdConfigForm', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'ShadcnConfigForm', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'PopoverTableSelect', exact: true })).toBeVisible()
}

test.describe('components playground 交互', () => {
  test('DateRangePicker 可以选择日期范围并同步展示值', async ({ page }) => {
    await openPlayground(page)
    await openComponent(page, 'DateRangePicker')

    const dialog = await openDateRangePopover(page)
    await dialog.getByRole('gridcell', { name: '10', exact: true }).first().click()
    await dialog.getByRole('gridcell', { name: '15', exact: true }).last().click()

    await expect(page.getByTestId('date-range-last')).toContainText('00:00:00')
    await expect(page.getByTestId('date-range-last')).toContainText('23:59:59')
  })

  test('EnterNextContainer 可以按 Enter 顺序移动焦点并暴露末尾事件', async ({ page }) => {
    await openPlayground(page)
    await openComponent(page, 'EnterNextContainer')

    const nameInput = page.getByRole('textbox', { name: '客户名称' })
    const contactInput = page.getByRole('textbox', { name: '联系人' })
    const levelInput = page.getByRole('combobox', { name: '客户等级' })
    const remarkTextarea = page.getByRole('textbox', { name: '备注' })

    await nameInput.click()
    await expect(nameInput).toBeFocused()

    await nameInput.press('Enter')
    await expect(contactInput).toBeFocused()

    await contactInput.press('Enter')
    await expect(levelInput).toBeFocused()

    await levelInput.press('Enter')
    await expect(page.getByTestId('enter-next-event')).toContainText('下拉控件未确认选项')

    await page.keyboard.press('Escape')
    await levelInput.press('Enter')
    await remarkTextarea.click()
    await expect(remarkTextarea).toBeFocused()
    await remarkTextarea.press('Enter')
    await expect(page.getByTestId('enter-next-event')).toContainText('已到最后一个控件')
  })

  test('PopoverTableSelect 可以筛选、选择并回填表格行', async ({ page }) => {
    await openPlayground(page)
    await openComponent(page, 'PopoverTableSelect')

    const popoverExample = page.getByTestId('popover-table-example')
    const input = popoverExample.locator('input').first()

    await input.fill('华南')
    await expect(input).toHaveValue('华南')
    await expect(page.locator('.mx-popover-table-select-base__row')).toHaveCount(1)
    const row = page.locator('.mx-popover-table-select-base__row', { hasText: '华南仓' })
    await expect(row).toBeVisible()
    await row.click()

    await expect(input).toHaveValue('C-002 华南仓')
    await expect(page.getByTestId('popover-selected-code')).toHaveText('C-002')
    await expect(page.getByTestId('popover-selected-name')).toHaveText('华南仓')
    await expect(page.getByTestId('popover-selected-owner')).toHaveText('运营二部')
    await expect(page.getByTestId('popover-selected-status')).toHaveText('启用')
  })

  test('ElementConfigForm 可以写回字段、展开条件字段并提交预览', async ({ page }) => {
    await openPlayground(page)
    await openComponent(page, 'ElementConfigForm')

    const example = page.getByTestId('element-config-form-example')

    await example.getByPlaceholder('请输入 Element 账户名称').fill('Element Cloud')
    await expect(example.getByPlaceholder('请输入 Element 高级备注')).toBeHidden()
    await example.getByText('启用高级字段', { exact: true }).click()
    await expect(example.getByPlaceholder('请输入 Element 高级备注')).toBeVisible()
    await example.getByPlaceholder('请输入 Element 高级备注').fill('Element 高级配置')
    await example.getByTestId('element-config-submit').click()

    await expect(example.getByTestId('element-config-preview')).toContainText('"accountName": "Element Cloud"')
    await expect(example.getByTestId('element-config-preview')).toContainText('"advanced": true')
    await expect(example.getByTestId('element-config-preview')).toContainText('"advancedNote": "Element 高级配置"')
  })

  test('antdConfigForm 可以自动适配 checked 协议并提交预览', async ({ page }) => {
    await openPlayground(page)
    await openComponent(page, 'antdConfigForm')

    const example = page.getByTestId('antd-config-form-example')

    await example.getByPlaceholder('请输入 Antd 项目名称').fill('Antd Portal')
    await expect(example.getByPlaceholder('请输入 Antd 发布备注')).toBeHidden()
    await example.getByText('允许发布', { exact: true }).click()
    await expect(example.getByPlaceholder('请输入 Antd 发布备注')).toBeVisible()
    await example.getByPlaceholder('请输入 Antd 发布备注').fill('Antd 发布说明')
    await example.getByTestId('antd-config-submit').click()

    await expect(example.getByTestId('antd-config-preview')).toContainText('"projectName": "Antd Portal"')
    await expect(example.getByTestId('antd-config-preview')).toContainText('"publish": true')
    await expect(example.getByTestId('antd-config-preview')).toContainText('"publishNote": "Antd 发布说明"')
  })

  test('ShadcnConfigForm 可以展示必填错误、选择套餐并提交预览', async ({ page }) => {
    await openPlayground(page)
    await openComponent(page, 'ShadcnConfigForm')

    const example = page.getByTestId('shadcn-config-form-example')

    await example.getByTestId('shadcn-config-submit').click()
    await expect(example.getByText('请输入工作区名称', { exact: true })).toBeVisible()
    await example.getByLabel('工作区名称').fill('Shadcn Workspace')
    await expect(example.getByText('请输入工作区名称', { exact: true })).toHaveCount(0)
    await example.getByLabel('套餐').selectOption('enterprise')
    await expect(example.getByLabel('企业备注')).toBeVisible()
    await example.getByLabel('企业备注').fill('Shadcn 企业备注')
    await example.getByTestId('shadcn-config-submit').click()

    await expect(example.getByTestId('shadcn-config-preview')).toContainText('"workspaceName": "Shadcn Workspace"')
    await expect(example.getByTestId('shadcn-config-preview')).toContainText('"plan": "enterprise"')
    await expect(example.getByTestId('shadcn-config-preview')).toContainText('"notes": "Shadcn 企业备注"')
  })

  test('sidebar 可以在三个组件示例间切换', async ({ page }) => {
    await openPlayground(page)

    for (const name of [
      'DateRangePicker',
      'EnterNextContainer',
      'PopoverTableSelect',
      'ElementConfigForm',
      'antdConfigForm',
      'ShadcnConfigForm',
    ]) {
      await openComponent(page, name)
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    }
  })
})
