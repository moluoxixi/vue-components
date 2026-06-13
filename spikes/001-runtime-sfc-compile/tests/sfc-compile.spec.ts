import { expect, test } from '@playwright/test'

// 这些断言是 spike 的 verdict 来源：真实 Chromium 里跑，不是"看日志说能用"。

test.describe('运行时 SFC 编译 — 两条路线', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等两条路线都挂载完（loader 是异步的）
    await expect(page.getByTestId('diy-mount')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('loader-mount')).toBeVisible({ timeout: 15000 })
  })

  test('路线 B（compiler-sfc + sucrase）：渲染 + 类型化 Props + 响应式', async ({ page }) => {
    const mount = page.getByTestId('diy-mount')
    // 初始 Props 渲染正确（label="Hello AI", count=1）
    await expect(mount.getByTestId('label')).toHaveText('Hello AI')
    await expect(mount.getByTestId('count')).toHaveText('count=1')
    // total = props.count(1) + internal ref(10) = 11 → 验证 setup 内响应式有效
    await expect(mount.getByTestId('total')).toHaveText('total=11')
    // 点 bump → internal++ → total 变 12，验证组件内部响应式真的活着
    await mount.getByTestId('bump').click()
    await expect(mount.getByTestId('total')).toHaveText('total=12')
  })

  test('路线 A（vue3-sfc-loader）：渲染 + 类型化 Props + 响应式', async ({ page }) => {
    const mount = page.getByTestId('loader-mount')
    await expect(mount.getByTestId('label')).toHaveText('Hello AI')
    await expect(mount.getByTestId('count')).toHaveText('count=1')
    await expect(mount.getByTestId('total')).toHaveText('total=11')
    await mount.getByTestId('bump').click()
    await expect(mount.getByTestId('total')).toHaveText('total=12')
  })

  test('外部改 Props → 两条路线视图实时更新（调试台核心能力）', async ({ page }) => {
    // 改 label
    await page.getByTestId('in-label').fill('Changed!')
    await expect(page.getByTestId('diy-mount').getByTestId('label')).toHaveText('Changed!')
    await expect(page.getByTestId('loader-mount').getByTestId('label')).toHaveText('Changed!')

    // 改 count → props.count 变，total 也随之变（props 响应式注入成功）
    await page.getByTestId('in-count').fill('5')
    await expect(page.getByTestId('diy-mount').getByTestId('count')).toHaveText('count=5')
    await expect(page.getByTestId('diy-mount').getByTestId('total')).toHaveText('total=15')
    await expect(page.getByTestId('loader-mount').getByTestId('count')).toHaveText('count=5')
    await expect(page.getByTestId('loader-mount').getByTestId('total')).toHaveText('total=15')
  })

  test('错误处理：坏 SFC 应抛错而非静默', async ({ page }) => {
    await expect(page.getByTestId('broken-result')).toContainText('✓ 正确抛错')
  })

  test('scoped 样式编译不报错（路线 B 注入了 scopeId）', async ({ page }) => {
    // h3 应被 scoped 样式染成蓝色 rgb(37, 99, 235)
    const h3 = page.getByTestId('diy-mount').getByTestId('label')
    await expect(h3).toHaveCSS('color', 'rgb(37, 99, 235)')
  })
})
