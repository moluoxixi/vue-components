import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'

test('current component page renders consumer features in light and dark modes', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/components/copy-text.html')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()
  await expect(page.locator('.component-doc-meta')).toHaveCSS('border-bottom-style', 'solid')
  await expect(page.getByRole('list', { name: 'CopyText 组件贡献者' })).toBeVisible()

  const headingSizes = await page.locator('.doc-content').evaluate(element => ({
    h1: Number.parseFloat(getComputedStyle(element.querySelector('h1')!).fontSize),
    h2: Number.parseFloat(getComputedStyle(element.querySelector('h2')!).fontSize),
  }))
  expect(headingSizes.h1).toBeGreaterThan(headingSizes.h2)
  expect(headingSizes.h2).toBeGreaterThan(16)

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
  await expect(demo.getByTestId('demo-source-language')).toBeVisible()
  await expect(demo.locator('.demo-source')).toContainText('lang="ts"')
  await demo.getByTestId('demo-source-language').getByText('JS', { exact: true }).click()
  await expect(demo.locator('.demo-source')).not.toContainText('lang="ts"')
  const sourceLink = demo.getByTestId('demo-source-link')
  await expect(sourceLink).toHaveAttribute(
    'href',
    /github\.com\/moluoxixi\/vue-components\/blob\/main\/packages\/components\/src\/CopyText\/docs\/index\.md\?plain=1#L\d+-L\d+$/,
  )
  await demo.getByTestId('demo-source-collapse').click()
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
  await page.getByRole('searchbox').fill('configForm')
  const configFormResults = page.getByRole('option').filter({ hasText: /ConfigForm/ })
  await expect(configFormResults).toHaveCount(2)
  await expect(configFormResults.filter({ hasText: 'AntdConfigForm' })).toBeVisible()
  await expect(configFormResults.filter({ hasText: 'ElementConfigForm' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: '搜索文档' }).click()
  await page.getByRole('searchbox').fill('迁移到另一个组件库')
  const result = page.getByRole('option', { name: '文档主题与复用 > 迁移到另一个组件库' })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/documentation-theme\.html#/)

  await page.goto('/components/config-table.html')
  await expect(page.getByText('10条/页', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('前往', { exact: true }).first()).toBeVisible()
  const toc = page.locator('.toc-wrapper')
  await expect(toc).toBeVisible()
  await expect(toc.getByRole('link', { name: '基础用法', exact: true })).toBeVisible()
  await expect(toc.getByRole('link', { name: 'Renderer 与列设置', exact: true })).toBeVisible()

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

test('current docs include runtime API headings in the table of contents', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/components/copy-text.html')
  await page.locator('.sidebar').getByRole('link', {
    name: 'ConfigTable 配置表格',
    exact: true,
  }).click()
  await expect(page).toHaveURL(/\/components\/config-table\.html$/)
  const toc = page.locator('#toc-desktop-panel')
  const apiLinks = toc.locator([
    'a[href="#api"]',
    'a[href="#ConfigTable-props"]',
    'a[href="#ConfigTable-emits"]',
    'a[href="#ConfigTable-slots"]',
    'a[href="#ConfigTable-expose"]',
  ].join(', '))

  await expect(apiLinks).toHaveText(['API', 'Props', 'Emits', 'Slots', 'Expose'])
  await expect.poll(() => apiLinks.evaluateAll(links => links.map((link) => {
    let depth = 0
    let item = link.closest('.el-anchor__item')
    while (item) {
      depth += 1
      item = item.parentElement?.closest('.el-anchor__item') ?? null
    }
    return depth
  }))).toEqual([1, 2, 2, 2, 2])

  expect(browserProblems).toEqual([])
})

test('component overview search and English routes stay localized', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/components/')
  const overview = page.locator('.component-overview')
  const search = overview.getByRole('textbox', { name: '搜索组件' })
  await expect(search).toHaveAttribute('placeholder', '搜索组件')
  await search.fill('复制')
  await expect(overview.getByRole('link', { name: /CopyText 带状态反馈的复制按钮/ })).toBeVisible()
  await expect(overview.getByRole('link', { name: /ConfigTable/ })).toHaveCount(0)
  await search.fill('不存在的组件')
  await expect(overview.getByText('未找到匹配的组件', { exact: true })).toBeVisible()

  await page.goto('/en/components/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  const englishOverview = page.locator('.component-overview')
  const englishSearch = englishOverview.getByRole('textbox', { name: 'Search components' })
  await expect(englishSearch).toHaveAttribute('placeholder', 'Search Components')
  await englishSearch.fill('CopyText')
  await expect(englishOverview.getByRole('link', { name: /CopyText Copy actions with built-in status feedback/ })).toBeVisible()
  await expect(englishOverview.getByRole('link', { name: /ConfigTable/ })).toHaveCount(0)
  await englishSearch.fill('No such component')
  await expect(englishOverview.getByText('No matching components found', { exact: true })).toBeVisible()

  await page.goto('/en/components/copy-text.html')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Basic Usage' })).toBeVisible()
  await expect(page.getByText('A copy-to-clipboard component with built-in loading, copied, and error feedback states.')).toBeVisible()
  await expect(page.locator('.api-docs')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Language' })).toBeVisible()

  await page.goto('/en/components/headless-table.html')
  await expect(page.locator('.api-docs')).toHaveCount(1)
  await expect(page.locator('.api-docs')).toContainText('"暂无数据"')

  await page.goto('/components/headless-table.html')
  await expect(page.locator('.api-docs')).toHaveCount(1)
  await expect(page.locator('.api-docs')).toContainText('"暂无数据"')

  await page.goto('/en/components/copy-text.html')
  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('link', { name: '简体中文' }).click()
  await expect(page).toHaveURL(/\/components\/copy-text\.html$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()

  await page.getByRole('button', { name: '语言' }).click()
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/en\/components\/copy-text\.html$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()

  expect(browserProblems).toEqual([])
})

test('current docs provide title navigation at every supported width', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)
  const viewports = [
    { width: 390, mobileSidebar: true, compactToc: true },
    { width: 768, mobileSidebar: true, compactToc: true },
    { width: 1024, mobileSidebar: false, compactToc: true },
    { width: 1280, mobileSidebar: false, compactToc: true },
    { width: 1440, mobileSidebar: false, compactToc: false },
  ] as const

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto('/components/config-table.html')

    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      root: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }))
    expect(widths.body).toBeLessThanOrEqual(widths.viewport)
    expect(widths.root).toBeLessThanOrEqual(widths.viewport)

    const sidebar = page.locator('.sidebar')
    const pageContent = page.locator('main.page-content')
    const content = page.locator('.doc-content-container')
    const toc = page.locator('.toc-wrapper')
    const compactTrigger = toc.getByRole('button', { name: '本页目录', exact: true })
    const sidebarBox = await sidebar.boundingBox()
    const pageContentBox = await pageContent.boundingBox()
    expect(sidebarBox).not.toBeNull()
    expect(pageContentBox).not.toBeNull()
    await expect(sidebar).toHaveCSS('position', 'fixed')
    expect(pageContentBox!.y).toBeLessThan(900)
    await expect(toc).toBeVisible()

    if (viewport.mobileSidebar) {
      expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(1)
    }
    else {
      const contentBox = await content.boundingBox()
      expect(contentBox).not.toBeNull()
      expect(sidebarBox!.x).toBeGreaterThanOrEqual(-1)
      expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(contentBox!.x + 1)
    }

    if (viewport.compactToc) {
      await expect(compactTrigger).toBeVisible()
      await expect(toc).toHaveCSS('position', 'sticky')
      await expect(compactTrigger).toHaveAttribute('aria-expanded', 'false')
      await expect(compactTrigger).toHaveAttribute('aria-haspopup', 'dialog')
      const tocPanel = page.locator('#toc-compact-panel')
      await expect(tocPanel).toHaveCount(0)
      await compactTrigger.click()
      await expect(compactTrigger).toHaveAttribute('aria-expanded', 'true')
      await expect(tocPanel).toHaveCount(1)
      await expect(tocPanel).toBeVisible()
      await expect(tocPanel).toHaveAttribute('aria-label', '本页目录')
      await expect(tocPanel.locator('a[href^="#"]')).toHaveText([
        '基础用法',
        'Renderer 与列设置',
        '远程请求 + 分页',
        '自定义单元格插槽',
        'API',
        '组件贡献者',
      ])
      await expect(tocPanel.getByRole('link', { name: '基础用法', exact: true })).toBeVisible()
      const linksResolveToHeadings = await tocPanel.locator('a[href^="#"]').evaluateAll(links => links.every((link) => {
        const href = link.getAttribute('href')
        return Boolean(href && document.querySelector(href))
      }))
      expect(linksResolveToHeadings).toBe(true)
      await tocPanel.getByRole('link', { name: '基础用法', exact: true }).click()
      await expect(tocPanel).toHaveCount(0)
      await expect(compactTrigger).toHaveAttribute('aria-expanded', 'false')
    }
    else {
      await expect(compactTrigger).toBeHidden()
      const tocPanel = page.locator('#toc-desktop-panel')
      await expect(tocPanel).toBeVisible()
      await expect(toc.getByRole('link', { name: '基础用法', exact: true })).toBeVisible()
      const [contentBox, tocBox] = await Promise.all([
        content.boundingBox(),
        toc.boundingBox(),
      ])
      expect(contentBox).not.toBeNull()
      expect(tocBox).not.toBeNull()
      expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(tocBox!.x + 1)
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/en/components/headless-table.html')
  const longTitle = page.locator('.toc-wrapper').getByRole('link', {
    name: 'Sorting and Filtering with useHeadlessTable',
    exact: true,
  })
  await expect(longTitle).toBeVisible()
  const titleLayout = await longTitle.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    }
  })
  expect(titleLayout.whiteSpace).toBe('normal')
  expect(titleLayout.textOverflow).toBe('clip')
  expect(titleLayout.scrollWidth).toBeLessThanOrEqual(titleLayout.clientWidth)

  expect(browserProblems).toEqual([])
})

test('current docs render the custom NotFound page', async ({ page }) => {
  await page.goto('/definitely-missing-theme-page.html')
  await expect(page.getByText('页面未找到', { exact: true })).toBeVisible()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Documentation' })).toHaveCount(0)
})
