import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'

test('current component page renders consumer features in light and dark modes', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/components/copy-text.html')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()
  await expect(page.locator('.component-doc-meta')).toHaveCSS('border-bottom-style', 'solid')
  await expect(page.getByRole('list', { name: 'CopyText 组件贡献者' })).toBeVisible()

  const demo = page.locator('.demo-block').first()
  await expect(demo).toBeVisible()
  await expect(demo.getByText('Hello, World!', { exact: true })).toBeVisible()
  await expect(page.getByText('加载中...', { exact: true })).toHaveCount(0)
  await expect(page).toHaveScreenshot('docs-component-desktop-light.png', { animations: 'allow' })

  await page.locator('.theme-toggler-content .el-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.locator('html').getAttribute('data-theme-transition')).toBeNull()
  await expect(page).toHaveScreenshot('docs-component-desktop-dark.png', { animations: 'allow' })
  await page.locator('.theme-toggler-content .el-switch__core').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  const demoToggle = demo.getByRole('button', { name: '展开示例代码' })
  await expect(demoToggle).toHaveAttribute('aria-expanded', 'false')
  await demoToggle.click()
  const collapseDemo = demo.getByRole('button', { name: '收起示例代码' })
  await expect(collapseDemo).toHaveAttribute('aria-expanded', 'true')
  await expect(demo.locator('.demo-source')).toHaveAttribute('aria-hidden', 'false')
  await collapseDemo.click()
  await expect(demo.getByRole('button', { name: '展开示例代码' })).toHaveAttribute('aria-expanded', 'false')
  await expect(demo.locator('.demo-source')).toHaveAttribute('aria-hidden', 'true')

  const changelogTrigger = page.getByRole('button', { name: /更新日志/ })
  await changelogTrigger.focus()
  await expect(changelogTrigger).toHaveAttribute('aria-haspopup', 'dialog')
  await changelogTrigger.click()
  const dialog = page.getByRole('dialog', { name: 'CopyText 更新日志' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('.component-changelog-dialog')).toBeFocused()
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(changelogTrigger).toBeFocused()
  expect(browserProblems).toEqual([])
})

test('current docs preserve search, Element Plus locale, and Playground behavior', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/guide/documentation-theme.html')
  await page.getByRole('button', { name: '搜索文档' }).click()
  await page.getByRole('searchbox').fill('迁移到另一个组件库')
  const result = page.getByRole('option', { name: '文档主题与复用 > 迁移到另一个组件库' })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/documentation-theme\.html#/)

  await page.goto('/components/config-table.html')
  await expect(page.getByText('10条/页', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('前往', { exact: true }).first()).toBeVisible()

  await page.goto('/playground.html')
  const playground = page.locator('main.page-content.docs-playground-page')
  await expect(playground).toBeVisible()
  await expect(playground).toHaveCSS('padding-top', '0px')
  const editor = page.getByTestId('playground-editor')
  await editor.fill('<template><p>Changed locally</p></template>')
  await page.getByTestId('playground-reset').click()
  await expect(editor).toHaveValue(/Hello, MX Components!/)
  await expect(page.getByTestId('playground-diagnostics')).toHaveCount(0)

  expect(browserProblems).toEqual([])
})

test('current docs render the custom NotFound page', async ({ page }) => {
  await page.goto('/definitely-missing-theme-page.html')
  await expect(page.getByText('页面未找到', { exact: true })).toBeVisible()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Documentation' })).toHaveCount(0)
})
