import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'
import { coldStartTimeout, docsVisualStylePath, openDocsPage, waitForCompiledDemos } from './page-readiness'

test('reviewed header controls stay visible and aligned across narrow and wide layouts', async ({ page }, testInfo) => {
  const browserProblems = collectBrowserProblems(page)
  await openDocsPage(page, '/components/rich-text-editor.html')
  await waitForCompiledDemos(page, '在这里输入内容……')

  for (const width of [320, 390, 764, 851, 1280]) {
    await page.setViewportSize({ width, height: 827 })
    await page.evaluate(() => window.scrollTo(0, 0))
    const navbar = page.locator('.ep-docs > .navbar')
    const controls = [
      navbar.locator('.theme-toggler-content .epd-switch__core'),
      navbar.getByRole('button', { name: '语言' }),
      navbar.getByRole('link', { name: 'GitHub', exact: true }),
    ]
    await expect(navbar.locator('.github-icon')).toBeVisible()
    for (const control of controls) {
      await expect(control).toBeVisible()
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(60)
    }
    if (width < 960) {
      await expect(navbar.getByRole('button', { name: '切换导航' })).toBeVisible()
      await expect(page.locator('.sub-nav')).toHaveCSS('height', '48px')
      const [barBox, tocBox] = await Promise.all([
        page.locator('.sub-nav').boundingBox(),
        page.locator('.toc-wrapper').boundingBox(),
      ])
      expect(tocBox!.y - (barBox!.y + barBox!.height)).toBeGreaterThanOrEqual(16)
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (width === 764)
      await page.screenshot({ path: testInfo.outputPath('reviewed-header-764.png') })
    await page.evaluate(() => window.scrollTo(0, 600))
    await expect.poll(() => navbar.evaluate(element => element.getBoundingClientRect().top)).toBe(0)
    if (width < 960) {
      await expect.poll(() => page.locator('.sub-nav').evaluate(element => element.getBoundingClientRect().top)).toBe(60)
    }
  }
  expect(browserProblems).toEqual([])
})

test('rich text block selector keeps native editing and explains disabled controls', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)
  await openDocsPage(page, '/components/rich-text-editor.html')
  const demo = await waitForCompiledDemos(page, '在这里输入内容……')
  const select = demo.getByRole('combobox', { name: '文本样式' })
  await expect(select).toHaveCSS('appearance', 'none')
  await expect(select).toHaveCSS('height', '30px')
  await expect(demo.locator('.mx-rich-text-editor__block-chevron')).toBeVisible()
  await select.selectOption('heading-1')
  await expect(demo.locator('.mx-rich-text-editor__content h1')).toHaveCount(1)
  await select.selectOption('paragraph')
  await expect(demo.locator('.mx-rich-text-editor__content h1')).toHaveCount(0)

  const disabledDemo = page.locator('.demo-block').nth(1)
  await expect(disabledDemo.locator('.demo-preview [class^="epd-"]')).toHaveCount(0)
  await disabledDemo.locator('.el-switch').first().click()
  const disabledSelect = disabledDemo.getByRole('combobox', { name: '文本样式' })
  await expect(disabledSelect).toBeDisabled()
  const hintTrigger = disabledDemo.locator('.mx-rich-text-editor__control').filter({ has: page.getByRole('combobox', { name: '文本样式' }) })
  await hintTrigger.hover()
  await expect(disabledDemo.getByRole('tooltip')).toHaveText('当前不可编辑；解除禁用或只读状态后可用。')
  expect(browserProblems).toEqual([])
})

test('rich text content keeps its typography inside the document theme', async ({ page }, testInfo) => {
  const browserProblems = collectBrowserProblems(page)
  await openDocsPage(page, '/components/rich-text-editor.html')
  await waitForCompiledDemos(page, '在这里输入内容……')
  const editorHeading = page.locator('.mx-rich-text-editor__content h2')
  await expect(editorHeading).toHaveText('季度发布说明')
  await expect(editorHeading).toHaveCSS('display', 'block')
  await expect(editorHeading).toHaveCSS('font-size', '22.4px')
  await expect(editorHeading).toHaveCSS('line-height', '29.12px')
  await expect(editorHeading).toHaveCSS('font-weight', '700')
  await expect(editorHeading).toHaveCSS('margin-top', '0px')
  const editorParagraph = editorHeading.locator('..').locator('p')
  await expect(editorParagraph).toHaveCSS('line-height', '26.4px')
  await expect(page.locator('.toc-wrapper')).not.toContainText('季度发布说明')
  await editorHeading.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('rich-text-isolated.png') })
  expect(browserProblems).toEqual([])
})

test('current component page renders consumer features in light and dark modes', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await openDocsPage(page, '/components/copy-text.html')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' }))
    .toBeVisible({ timeout: coldStartTimeout })
  await expect(page.locator('.component-doc-meta')).toHaveCSS('border-bottom-style', 'solid')
  await expect(page.getByRole('list', { name: 'CopyText 组件贡献者' })).toBeVisible()

  const headingSizes = await page.locator('.doc-content').evaluate(element => ({
    h1: Number.parseFloat(getComputedStyle(element.querySelector('h1')!).fontSize),
    h2: Number.parseFloat(getComputedStyle(element.querySelector('h2')!).fontSize),
  }))
  expect(headingSizes.h1).toBeGreaterThan(headingSizes.h2)
  expect(headingSizes.h2).toBeGreaterThan(16)

  const demo = await waitForCompiledDemos(page)
  await expect(page.getByText('加载中...', { exact: true })).toHaveCount(0)

  await page.locator('.theme-toggler-content .epd-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.locator('html').getAttribute('data-theme-transition')).toBeNull()
  await page.locator('.theme-toggler-content .epd-switch__core').click()
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
  await expect(demo.getByTestId('demo-source-link')).toHaveCount(0)
  await demo.getByTestId('demo-source-collapse').click()
  await expect(demo.getByRole('button', { name: '展开示例代码' })).toHaveAttribute('aria-expanded', 'false')
  await expect(demo.locator('.demo-source')).toHaveAttribute('aria-hidden', 'true')

  const changelogTrigger = page.getByRole('button', { name: /更新日志/ })
  await changelogTrigger.focus()
  await expect(changelogTrigger).toHaveAttribute('aria-haspopup', 'dialog')
  await changelogTrigger.click()
  const dialog = page.getByRole('dialog', { name: 'CopyText 更新日志' })
  await expect(dialog).toBeVisible()
  const overlay = page.locator('.epd-overlay').filter({ has: dialog })
  await expect(overlay).toHaveCSS('position', 'fixed')
  await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.5)')
  const overlayBounds = await overlay.boundingBox()
  expect(overlayBounds).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 })
  await expect(page.locator('.component-changelog-dialog')).toBeFocused()
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(changelogTrigger).toBeFocused()
  expect(browserProblems).toEqual([])
})

test('current docs preserve search, Element Plus locale, and Playground behavior', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await openDocsPage(page, '/guide/documentation-theme.html')
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

  await openDocsPage(page, '/components/config-table.html')
  await expect(page.getByText('10条/页', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('前往', { exact: true }).first()).toBeVisible()
  const toc = page.locator('.toc-wrapper')
  await expect(toc).toBeVisible()
  await expect(toc.getByRole('link', { name: '基础用法', exact: true })).toBeVisible()
  await expect(toc.getByRole('link', { name: 'Renderer', exact: true })).toBeVisible()
  await expect(toc.getByRole('link', { name: '列配置面板', exact: true })).toBeVisible()

  await openDocsPage(page, '/playground.html')
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

test('@visual current component page matches desktop baselines', async ({ page }) => {
  await openDocsPage(page, '/components/copy-text.html')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' }))
    .toBeVisible({ timeout: coldStartTimeout })
  await waitForCompiledDemos(page)
  await expect(page).toHaveScreenshot('docs-component-desktop-light.png', {
    animations: 'allow',
    stylePath: docsVisualStylePath,
  })

  await page.locator('.theme-toggler-content .epd-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.locator('html').getAttribute('data-theme-transition')).toBeNull()
  await expect(page).toHaveScreenshot('docs-component-desktop-dark.png', {
    animations: 'allow',
    stylePath: docsVisualStylePath,
  })
})

test('current docs include runtime API headings in the table of contents', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await openDocsPage(page, '/components/copy-text.html')
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
    let item = link.closest('.epd-anchor__item')
    while (item) {
      depth += 1
      item = item.parentElement?.closest('.epd-anchor__item') ?? null
    }
    return depth
  }))).toEqual([1, 2, 2, 2, 2])

  expect(browserProblems).toEqual([])
})

test('component overview search and English routes stay localized', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await openDocsPage(page, '/components/')
  const overview = page.locator('.component-overview')
  const search = overview.getByRole('textbox', { name: '搜索组件' })
  await expect(search).toHaveAttribute('placeholder', '搜索组件')
  await search.fill('复制')
  await expect(overview.getByRole('link', { name: /CopyText 带状态反馈的复制按钮/ })).toBeVisible()
  await expect(overview.getByRole('link', { name: /ConfigTable/ })).toHaveCount(0)
  await search.fill('不存在的组件')
  await expect(overview.getByText('未找到匹配的组件', { exact: true })).toBeVisible()

  await openDocsPage(page, '/en/components/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  const englishOverview = page.locator('.component-overview')
  const englishSearch = englishOverview.getByRole('textbox', { name: 'Search components' })
  await expect(englishSearch).toHaveAttribute('placeholder', 'Search Components')
  await englishSearch.fill('CopyText')
  await expect(englishOverview.getByRole('link', { name: /CopyText Copy actions with built-in status feedback/ })).toBeVisible()
  await expect(englishOverview.getByRole('link', { name: /ConfigTable/ })).toHaveCount(0)
  await englishSearch.fill('No such component')
  await expect(englishOverview.getByText('No matching components found', { exact: true })).toBeVisible()

  await openDocsPage(page, '/en/components/copy-text.html')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Basic Usage' })).toBeVisible()
  await expect(page.getByText('A copy-to-clipboard component with built-in loading, copied, and error feedback states.')).toBeVisible()
  await expect(page.locator('.api-docs')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Language' })).toBeVisible()

  await openDocsPage(page, '/en/components/headless-table.html')
  await expect(page.locator('.api-docs')).toHaveCount(1)
  await expect(page.locator('.api-docs')).toContainText('"暂无数据"')

  await openDocsPage(page, '/components/headless-table.html')
  await expect(page.locator('.api-docs')).toHaveCount(1)
  await expect(page.locator('.api-docs')).toContainText('"暂无数据"')

  await openDocsPage(page, '/en/components/copy-text.html')
  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('menuitem', { name: '简体中文' }).click()
  await expect(page).toHaveURL(/\/components\/copy-text\.html$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()

  await page.getByRole('button', { name: '语言' }).click()
  await page.getByRole('menuitem', { name: 'English', exact: true }).click()
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
    await openDocsPage(page, '/components/config-table.html')

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
        'Renderer',
        '列配置面板',
        '远程请求 + 分页',
        '编辑模式',
        '自定义单元格插槽',
        'API',
        'Props',
        'Emits',
        'Slots',
        'Expose',
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
  await openDocsPage(page, '/en/components/headless-table.html')
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
