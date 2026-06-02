import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

type SuiteId = 'element' | 'antd' | 'shadcn'
type ExpectedValues = Record<string, unknown>

interface FieldExpectation {
  values: ExpectedValues
}

interface ContainerExpectation {
  classPattern: RegExp
  layoutSelector: string
  testId: string
}

interface ConfigFormSuite {
  containerNodes: ContainerExpectation[]
  id: SuiteId
  libraryTabName: string
  rootTestId: string
  formItemSelector: string
  linkedAdvancedProbeTestId: string
  fillKnownControls: (page: Page, scope: Locator, prefix: string) => Promise<FieldExpectation>
  setLinkedNotifyChannel: (page: Page, scenario: Locator) => Promise<void>
  setLinkedSeatCount: (scenario: Locator) => Promise<void>
}

const suites: ConfigFormSuite[] = [
  {
    containerNodes: [
      { classPattern: /el-card/, layoutSelector: '.config-form-demo__container', testId: 'element-container-node' },
      { classPattern: /el-collapse/, layoutSelector: '.el-collapse-item__content', testId: 'element-container-collapse-node' },
      { classPattern: /el-tabs/, layoutSelector: '.el-tab-pane', testId: 'element-container-tabs-node' },
    ],
    fillKnownControls: fillElementKnownControls,
    formItemSelector: '.el-form-item',
    id: 'element',
    libraryTabName: 'Element',
    linkedAdvancedProbeTestId: 'element-linked-select',
    rootTestId: 'element-config-form-example',
    setLinkedNotifyChannel: setElementLinkedNotifyChannel,
    setLinkedSeatCount: setElementLinkedSeatCount,
  },
  {
    containerNodes: [
      { classPattern: /ant-card/, layoutSelector: '.ant-card-body', testId: 'antd-container-node' },
      { classPattern: /ant-collapse/, layoutSelector: '.ant-collapse-content-box', testId: 'antd-container-collapse-node' },
      { classPattern: /ant-tabs/, layoutSelector: '.ant-tabs-tabpane-active', testId: 'antd-container-tabs-node' },
    ],
    fillKnownControls: fillAntdKnownControls,
    formItemSelector: '.ant-form-item',
    id: 'antd',
    libraryTabName: 'Antd',
    linkedAdvancedProbeTestId: 'antd-linked-select',
    rootTestId: 'antd-config-form-example',
    setLinkedNotifyChannel: setAntdLinkedNotifyChannel,
    setLinkedSeatCount: setAntdLinkedSeatCount,
  },
  {
    containerNodes: [
      { classPattern: /shadcn-card/, layoutSelector: '.shadcn-card__body', testId: 'shadcn-container-node' },
      { classPattern: /shadcn-accordion/, layoutSelector: '.shadcn-accordion__body', testId: 'shadcn-container-accordion-node' },
      { classPattern: /shadcn-tabs-container/, layoutSelector: '.shadcn-tab-pane', testId: 'shadcn-container-tabs-node' },
    ],
    fillKnownControls: fillShadcnKnownControls,
    formItemSelector: '.mx-shadcn-config-form__field',
    id: 'shadcn',
    libraryTabName: 'Shadcn',
    linkedAdvancedProbeTestId: 'shadcn-linked-native-select',
    rootTestId: 'shadcn-config-form-example',
    setLinkedNotifyChannel: setShadcnLinkedNotifyChannel,
    setLinkedSeatCount: setShadcnLinkedSeatCount,
  },
]

async function openConfigFormExample(page: Page, suite: ConfigFormSuite): Promise<Locator> {
  const libraryTabs = page.getByTestId('config-form-library-tabs')

  await libraryTabs.getByRole('tab', { name: suite.libraryTabName, exact: true }).click()

  return page.getByTestId(suite.rootTestId)
}

async function openPlayground(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('config-form-library-tabs')).toBeVisible({ timeout: 30_000 })
}

async function selectScenarioTab(example: Locator, tabName: string): Promise<void> {
  await example.getByRole('tab', { name: tabName, exact: true }).click()
}

async function expectPreviewObject(preview: Locator, expected: unknown): Promise<void> {
  await expect.poll(async () => JSON.parse((await preview.textContent())!)).toMatchObject(expected)
}

async function expectInlineVisualSpacing(example: Locator, suite: ConfigFormSuite): Promise<void> {
  const row = example.getByTestId(`${suite.id}-layout-inline-row`)

  await expect(row).toBeVisible()

  const metrics = await row.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const styles = getComputedStyle(element)

    return {
      rowGap: Number.parseFloat(styles.rowGap),
      x: rect.x,
    }
  })

  expect(metrics.x).toBeGreaterThanOrEqual(0)
  expect(metrics.rowGap).toBeGreaterThanOrEqual(14)
}

async function expectContainerVisualSpacing(containerNode: Locator, layoutSelector: string): Promise<void> {
  const layout = containerNode.locator(layoutSelector).filter({ visible: true }).first()

  await expect(layout).toBeVisible()

  const metrics = await layout.evaluate((element) => {
    const styles = getComputedStyle(element)
    const layoutRect = element.getBoundingClientRect()
    const firstVisibleChild = Array
      .from(element.children)
      .find((child) => {
        const childRect = child.getBoundingClientRect()
        const childStyles = getComputedStyle(child)

        return childRect.width > 0 && childRect.height > 0 && childStyles.display !== 'none'
      })
    const firstVisibleChildRect = firstVisibleChild?.getBoundingClientRect()

    return {
      display: styles.display,
      firstVisibleChildOffset: firstVisibleChildRect ? firstVisibleChildRect.x - layoutRect.x : 0,
      gap: Number.parseFloat(styles.gap),
      width: layoutRect.width,
    }
  })

  expect(metrics.display).toBe('grid')
  expect(metrics.gap).toBeGreaterThanOrEqual(14)
  expect(metrics.firstVisibleChildOffset).toBeLessThan(metrics.width / 2)
}

function getOptionLabel(prefix: string): string {
  return prefix.replace(/^(element|antd|shadcn)-/, '')
}

async function clickVisibleText(page: Page, text: string): Promise<void> {
  const target = page.getByText(text, { exact: true }).filter({ visible: true }).last()

  await expect(target).toBeVisible()
  await target.click()
}

async function chooseElementOption(page: Page, optionName: string): Promise<void> {
  const option = page.getByRole('option', { name: optionName, exact: true }).filter({ visible: true }).last()

  await expect(option).toBeVisible()
  await option.click({ force: true })
}

async function chooseElementSelectOption(page: Page, scope: Locator, prefix: string, optionName: string): Promise<void> {
  const select = scope.getByTestId(`${prefix}-select`)
  const option = page.locator('.el-select-dropdown__item', { hasText: optionName }).filter({ visible: true })

  await select.click()
  await expect(option).toHaveCount(1)
  await option.click()
  await expect(select).toContainText(optionName)
}

async function chooseElementSelectV2Option(page: Page, scope: Locator, prefix: string, optionName: string): Promise<void> {
  const select = scope.getByTestId(`${prefix}-select-v2`)
  const option = page.locator('.el-select-dropdown__item', { hasText: optionName }).filter({ visible: true })

  await select.click()
  await expect(option).toHaveCount(1)
  await option.click()
  await expect(select).toContainText(optionName)
}

async function chooseAntdOption(page: Page, optionName: string): Promise<void> {
  const option = page
    .locator('.ant-select-item-option, .ant-cascader-menu-item, .ant-tree-treenode', { hasText: optionName })
    .filter({ visible: true })
    .last()

  await expect(option).toBeVisible()
  await option.click()
}

async function fillElementKnownControls(page: Page, scope: Locator, prefix: string): Promise<FieldExpectation> {
  const optionLabel = getOptionLabel(prefix)
  const values = {
    autocomplete: `${prefix} 自动完成值`,
    cascader: `${optionLabel}-shanghai`,
    checkbox: true,
    checkboxGroup: ['mail'],
    color: '#409EFF',
    date: '2026-06-01',
    input: `${prefix} 文本`,
    inputNumber: 42,
    radio: 'enterprise',
    rate: 1,
    select: `${optionLabel}-enabled`,
    selectV2: `${optionLabel}-large`,
    slider: 10,
    switchValue: true,
    textarea: `${prefix} 多行内容`,
    time: '09:00:00',
    timeSelect: '09:00',
    treeSelect: `${optionLabel}-root-a`,
  }

  await scope.getByPlaceholder(`${prefix} 文本输入`).fill(values.input)
  await scope.getByPlaceholder(`${prefix} 多行文本`).fill(values.textarea)
  await scope.getByTestId(`${prefix}-input-number`).locator('input').fill(String(values.inputNumber))
  await scope.getByPlaceholder(`${prefix} 自动完成`).fill(values.autocomplete)

  await chooseElementSelectOption(page, scope, prefix, `${optionLabel} 启用`)
  await chooseElementSelectV2Option(page, scope, prefix, `${optionLabel} 大型`)

  await scope.locator('.el-cascader').click()
  await clickVisibleText(page, `${optionLabel} 华东`)
  await clickVisibleText(page, `${optionLabel} 上海`)
  await scope.getByText(`${optionLabel} 开启`, { exact: true }).click()
  await scope.getByText(`${optionLabel} 邮件`, { exact: true }).click()
  await scope.getByTestId(`${prefix}-switch`).click()
  await scope.getByTestId(`${prefix}-radio`).getByText('企业', { exact: true }).click()
  await expect(scope.locator('.el-rate')).toBeVisible()
  await expect(scope.locator('.el-slider')).toHaveCount(1)
  await expect(scope.locator('.el-color-picker')).toBeVisible()
  await expect(scope.locator('.el-date-editor')).toHaveCount(2)
  await expect(scope.getByText(values.timeSelect, { exact: true }).first()).toBeVisible()

  return { values }
}

async function fillAntdKnownControls(page: Page, scope: Locator, prefix: string): Promise<FieldExpectation> {
  const optionLabel = getOptionLabel(prefix)
  const values = {
    autoComplete: `${optionLabel} 推荐项`,
    cascader: [`${optionLabel}-east`, `${optionLabel}-shanghai`],
    checkbox: true,
    checkboxGroup: ['mail'],
    date: '2026-06-01',
    input: `${prefix} 文本`,
    inputNumber: 42,
    password: `${prefix} 密码`,
    radio: 'enterprise',
    range: ['2026-06-01', '2026-06-03'],
    rate: 1,
    search: `${prefix} 搜索`,
    select: `${optionLabel}-enabled`,
    slider: 10,
    switchValue: true,
    textarea: `${prefix} 多行内容`,
    time: '09:00:00',
    timeRange: ['09:00:00', '10:00:00'],
    treeSelect: `${optionLabel}-root-a`,
  }

  await scope.getByPlaceholder(`${prefix} 文本输入`).fill(values.input)
  await scope.getByPlaceholder(`${prefix} 多行文本`).fill(values.textarea)
  await scope.getByPlaceholder(`${prefix} 密码输入`).fill(values.password)
  await scope.getByPlaceholder(`${prefix} 搜索输入`).fill(values.search)
  await scope.locator('.ant-input-number input').first().fill(String(values.inputNumber))
  await scope.getByTestId(`${prefix}-select`).click()
  await chooseAntdOption(page, `${optionLabel} 启用`)
  await scope.getByTestId(`${prefix}-cascader`).click()
  await chooseAntdOption(page, `${optionLabel} 华东`)
  await chooseAntdOption(page, `${optionLabel} 上海`)
  await scope.getByText(`${optionLabel} 开启`, { exact: true }).click()
  await scope.getByText(`${optionLabel} 邮件`, { exact: true }).click()
  await scope.getByTestId(`${prefix}-switch`).click()
  await scope.getByTestId(`${prefix}-radio`).getByText('企业', { exact: true }).click()
  await expect(scope.locator('.ant-rate')).toBeVisible()
  await expect(scope.locator('.ant-slider')).toBeVisible()
  await expect(scope.locator('.ant-picker')).toHaveCount(prefix === 'antd-linked' ? 5 : 4)

  return { values }
}

async function fillShadcnKnownControls(_page: Page, scope: Locator, prefix: string): Promise<FieldExpectation> {
  const optionLabel = getOptionLabel(prefix)
  const values = {
    checkbox: true,
    input: `${prefix} 文本`,
    inputNumber: 42,
    nativeSelect: `${optionLabel}-enabled`,
    radio: 'enterprise',
    slider: 10,
    switchValue: true,
    textarea: `${prefix} 多行内容`,
  }

  await scope.getByTestId(`${prefix}-input`).fill(values.input)
  await scope.getByTestId(`${prefix}-native-select`).selectOption(values.nativeSelect)
  await scope.getByTestId(`${prefix}-input-number`).fill(String(values.inputNumber))
  await expect(scope.getByTestId(`${prefix}-slider`)).toBeVisible()
  await scope.getByTestId(`${prefix}-textarea`).fill(values.textarea)
  await scope.getByTestId(`${prefix}-checkbox`).click()
  await scope.getByTestId(`${prefix}-switch`).click()
  await scope.getByTestId(`${prefix}-radio`).getByRole('radio', { name: '企业', exact: true }).click()

  return { values }
}

async function setElementLinkedNotifyChannel(page: Page, scenario: Locator): Promise<void> {
  await scenario.getByTestId('element-linked-notify-channel').click()
  await chooseElementOption(page, '预约通知')
}

async function setElementLinkedSeatCount(scenario: Locator): Promise<void> {
  await scenario.getByTestId('element-linked-seat-count').locator('input').fill('8')
}

async function setAntdLinkedNotifyChannel(page: Page, scenario: Locator): Promise<void> {
  await scenario.getByTestId('antd-linked-notify-channel').click()
  await chooseAntdOption(page, '预约通知')
}

async function setAntdLinkedSeatCount(scenario: Locator): Promise<void> {
  await scenario.getByRole('spinbutton', { name: /席位数/ }).fill('8')
}

async function setShadcnLinkedNotifyChannel(_page: Page, scenario: Locator): Promise<void> {
  await scenario.getByTestId('shadcn-linked-notify-channel').selectOption('scheduled')
}

async function setShadcnLinkedSeatCount(scenario: Locator): Promise<void> {
  await scenario.getByTestId('shadcn-linked-seat-count').fill('8')
}

test.describe('ConfigForm playground 布局场景', () => {
  for (const suite of suites) {
    test(`${suite.libraryTabName} 通过 switch 切换 inline/grid 并覆盖已知组件`, async ({ page }) => {
      await openPlayground(page)
      const example = await openConfigFormExample(page, suite)

      await expect(example.getByTestId(`${suite.id}-layout-mode-label`)).toContainText('inline')
      await expect(example.getByTestId(`${suite.id}-layout-inline`)).toBeVisible()
      await expectInlineVisualSpacing(example, suite)

      const inlineExpected = await suite.fillKnownControls(page, example.getByTestId(`${suite.id}-layout-inline`), `${suite.id}-inline`)
      await example.getByTestId(`${suite.id}-layout-inline-submit`).click()
      await expectPreviewObject(example.getByTestId(`${suite.id}-layout-preview`), {
        inline: inlineExpected.values,
      })

      await example.getByTestId(`${suite.id}-layout-mode-switch`).click()
      await expect(example.getByTestId(`${suite.id}-layout-mode-label`)).toContainText('grid')
      await expect(example.getByTestId(`${suite.id}-layout-grid-form`)).toBeVisible()

      const gridExpected = await suite.fillKnownControls(page, example.getByTestId(`${suite.id}-layout-grid-form`), `${suite.id}-grid`)
      await example.getByTestId(`${suite.id}-layout-grid-submit`).click()
      await expectPreviewObject(example.getByTestId(`${suite.id}-layout-preview`), {
        grid: gridExpected.values,
        inline: inlineExpected.values,
      })
    })
  }
})

test.describe('ConfigForm playground 容器场景', () => {
  for (const suite of suites) {
    test(`${suite.libraryTabName} 多容器 tab 不生成 FormItem 且覆盖已知组件`, async ({ page }) => {
      await openPlayground(page)
      const example = await openConfigFormExample(page, suite)

      await selectScenarioTab(example, '容器')
      const scenario = example.getByTestId(`${suite.id}-container-scenario`)
      const primaryContainerNode = suite.containerNodes[0]!

      for (const containerNodeExpectation of suite.containerNodes) {
        const containerNode = scenario.getByTestId(containerNodeExpectation.testId)

        await expect(containerNode).toBeVisible()
        await expect(containerNode).toHaveClass(containerNodeExpectation.classPattern)
        await expect(containerNode.locator(suite.formItemSelector)).toHaveCount(0)
        await expectContainerVisualSpacing(containerNode, containerNodeExpectation.layoutSelector)
      }

      const expected = await suite.fillKnownControls(page, scenario.getByTestId(primaryContainerNode.testId), `${suite.id}-container`)
      await scenario.getByTestId(`${suite.id}-container-submit`).click()
      await expectPreviewObject(scenario.getByTestId(`${suite.id}-container-preview`), expected.values)
    })
  }
})

test.describe('ConfigForm playground 联动场景', () => {
  for (const suite of suites) {
    test(`${suite.libraryTabName} 联动 tab 覆盖 switch/radio/checkbox/select/number 条件`, async ({ page }) => {
      await openPlayground(page)
      const example = await openConfigFormExample(page, suite)

      await selectScenarioTab(example, '联动')
      const scenario = example.getByTestId(`${suite.id}-linked-scenario`)

      await expect(scenario.getByTestId(suite.linkedAdvancedProbeTestId)).toBeHidden()
      await expect(scenario.getByTestId(`${suite.id}-linked-enterprise-name`)).toBeHidden()
      await expect(scenario.getByTestId(`${suite.id}-linked-marketing-note`)).toBeHidden()
      await expect(scenario.getByTestId(`${suite.id}-linked-seat-note`)).toBeHidden()

      const scheduledProbe = suite.id === 'antd'
        ? scenario.getByRole('textbox', { name: /预约时间/ })
        : scenario.getByTestId(suite.id === 'shadcn' ? 'shadcn-linked-scheduled-note' : `${suite.id}-linked-scheduled-time`)

      await expect(scheduledProbe).toBeHidden()

      await scenario.getByTestId(`${suite.id}-linked-advanced-switch`).click()
      await expect(scenario.getByTestId(suite.linkedAdvancedProbeTestId)).toBeVisible()

      await scenario.getByTestId(`${suite.id}-linked-plan-radio`).getByText('企业', { exact: true }).click()
      await expect(scenario.getByTestId(`${suite.id}-linked-enterprise-name`)).toBeVisible()
      await scenario.getByPlaceholder('企业模式显示').fill(`${suite.id} 企业名称`)

      await scenario.getByTestId(`${suite.id}-linked-marketing-checkbox`).click()
      await expect(scenario.getByTestId(`${suite.id}-linked-marketing-note`)).toBeVisible()
      await scenario.getByPlaceholder('勾选后显示').fill(`${suite.id} 营销备注`)

      await suite.setLinkedNotifyChannel(page, scenario)
      await expect(scheduledProbe).toBeVisible()

      await suite.setLinkedSeatCount(scenario)
      await expect(scenario.getByTestId(`${suite.id}-linked-seat-note`)).toBeVisible()
      await scenario.getByPlaceholder('席位数达到 5 后显示').fill(`${suite.id} 席位说明`)

      const expected = await suite.fillKnownControls(page, scenario, `${suite.id}-linked`)
      await scenario.getByTestId(`${suite.id}-linked-submit`).click()
      await expectPreviewObject(scenario.getByTestId(`${suite.id}-linked-preview`), {
        advanced: true,
        enterpriseName: `${suite.id} 企业名称`,
        marketing: true,
        marketingNote: `${suite.id} 营销备注`,
        notifyChannel: 'scheduled',
        planType: 'enterprise',
        seatCount: 8,
        seatNote: `${suite.id} 席位说明`,
        ...expected.values,
      })
    })
  }
})

test('ConfigForm 示例用 Element Tabs 切换三套 UI 库', async ({ page }) => {
  await openPlayground(page)

  const libraryTabs = page.getByTestId('config-form-library-tabs')

  for (const suite of suites) {
    await libraryTabs.getByRole('tab', { name: suite.libraryTabName, exact: true }).click()
    await expect(page.getByTestId(suite.rootTestId)).toBeVisible()
  }
})
