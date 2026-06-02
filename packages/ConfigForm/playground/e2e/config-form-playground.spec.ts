import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

async function openConfigFormExample(page: Page, name: string): Promise<void> {
  await page.getByRole('menuitem', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

async function openPlayground(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('menuitem', { name: 'ElementConfigForm', exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('menuitem', { name: 'antdConfigForm', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'ShadcnConfigForm', exact: true })).toBeVisible()
}

test.describe('ConfigForm playground 交互', () => {
  test('ElementConfigForm 可以写回字段、展开条件字段并提交预览', async ({ page }) => {
    await openPlayground(page)
    await openConfigFormExample(page, 'ElementConfigForm')

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

  test('antdConfigForm 可以使用 checked 绑定展开条件字段并提交预览', async ({ page }) => {
    await openPlayground(page)
    await openConfigFormExample(page, 'antdConfigForm')

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
    await openConfigFormExample(page, 'ShadcnConfigForm')

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

  test('sidebar 可以在三个 ConfigForm 示例间切换', async ({ page }) => {
    await openPlayground(page)

    for (const name of [
      'ElementConfigForm',
      'antdConfigForm',
      'ShadcnConfigForm',
    ]) {
      await openConfigFormExample(page, name)
    }
  })
})
