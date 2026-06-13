import { expect, test } from '@playwright/test'

// 沙箱是 opaque-origin iframe，外部无法穿透读取其 DOM。
// 因此所有断言通过宿主页面的可见 log/probe（沙箱 postMessage 回传后宿主写入）间接验证。

test.describe('iframe 沙箱隔离执行 AI 生成 SFC', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等待沙箱就绪 + 挂载完成
    await expect(page.locator('#log')).toContainText('ready', { timeout: 15000 })
  })

  test('沙箱内 SFC 编译并挂载成功', async ({ page }) => {
    await expect(page.locator('#log')).toContainText('mounted', { timeout: 15000 })
    await expect(page.locator('#log')).not.toContainText('error:')
  })

  test('隔离：沙箱无法访问父页面（DOM/location），宿主未被篡改', async ({ page }) => {
    await expect(page.locator('#probe')).not.toHaveText('', { timeout: 15000 })
    const probe = JSON.parse(await page.locator('#probe').textContent() ?? '{}')
    // 三项越权尝试全部 BLOCKED
    expect(probe.readParentDoc).toContain('BLOCKED')
    expect(probe.writeParentDoc).toContain('BLOCKED')
    expect(probe.readParentLocation).toContain('BLOCKED')
    // 宿主标题未被沙箱的 'HACKED' 写入篡改
    await expect(page.locator('#host-title')).toHaveText('Host Page')
    await expect(page).toHaveTitle(/Spike 002/)
  })

  test('双向同步：宿主下发 update-props → 沙箱组件接收（无错误）', async ({ page }) => {
    await expect(page.locator('#log')).toContainText('mounted', { timeout: 15000 })
    await page.evaluate(() => (window as any).__updateProps({ count: 99, label: 'Updated' }))
    // 给一帧时间；断言过程无 error 回传（props 成功应用到响应式 state）
    await page.waitForTimeout(300)
    await expect(page.locator('#log')).not.toContainText('error:')
  })

  test('事件回传：沙箱组件 emit(ping) → 宿主收到 event', async ({ page }) => {
    await expect(page.locator('#log')).toContainText('mounted', { timeout: 15000 })
    // 点击沙箱内按钮：跨 opaque origin 无法直接定位，用键盘/坐标不可靠，
    // 改为让沙箱自身在 mounted 后不自动触发，这里通过 frameLocator 尝试点击。
    const frame = page.frameLocator('#sandbox')
    await frame.getByTestId('sbx-bump').click({ timeout: 10000 })
    await expect(page.locator('#log')).toContainText('event:', { timeout: 10000 })
    await expect(page.locator('#log')).toContainText('"name":"ping"')
  })

  test('样式隔离：沙箱 scoped 样式不污染宿主', async ({ page }) => {
    await expect(page.locator('#log')).toContainText('mounted', { timeout: 15000 })
    // 宿主标题颜色应为默认（非沙箱里的绿色 rgb(0,128,0)）
    const color = await page.locator('#host-title').evaluate(el => getComputedStyle(el).color)
    expect(color).not.toBe('rgb(0, 128, 0)')
  })
})
