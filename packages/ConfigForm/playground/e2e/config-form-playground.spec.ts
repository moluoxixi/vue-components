import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

type SuiteId = 'element' | 'antd' | 'shadcn'
type ExpectedValues = Record<string, unknown>

interface FieldExpectation {
  values: ExpectedValues
}

interface ConfigFormSuite {
  containerClassPattern: RegExp
  id: SuiteId
  libraryTabName: string
  rootTestId: string
  formItemSelector: string
  linkedProbeTestId: string
  fillKnownControls: (page: Page, scope: Locator, prefix: string) => Promise<FieldExpectation>
}

const suites: ConfigFormSuite[] = [
  {
    containerClassPattern: /el-card/,
    fillKnownControls: fillElementKnownControls,
    formItemSelector: '.el-form-item',
    id: 'element',
    libraryTabName: 'Element',
    linkedProbeTestId: 'element-linked-select',
    rootTestId: 'element-config-form-example',
  },
  {
    containerClassPattern: /ant-card/,
    fillKnownControls: fillAntdKnownControls,
    formItemSelector: '.ant-form-item',
    id: 'antd',
    libraryTabName: 'Antd',
    linkedProbeTestId: 'antd-linked-select',
    rootTestId: 'antd-config-form-example',
  },
  {
    containerClassPattern: /shadcn-card/,
    fillKnownControls: fillShadcnKnownControls,
    formItemSelector: '.mx-shadcn-config-form__field',
    id: 'shadcn',
    libraryTabName: 'Shadcn',
    linkedProbeTestId: 'shadcn-linked-native-select',
    rootTestId: 'shadcn-config-form-example',
  },
]

async function openConfigFormExample(page: Page, suite: ConfigFormSuite): Promise<Locator> {
  await page.getByRole('menuitem', { name: 'ConfigForm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ConfigForm', exact: true })).toBeVisible()

  const libraryTabs = page.getByTestId('config-form-library-tabs')

  await libraryTabs.getByRole('tab', { name: suite.libraryTabName, exact: true }).click()

  return page.getByTestId(suite.rootTestId)
}

async function openPlayground(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('menuitem', { name: 'ConfigForm', exact: true })).toBeVisible({ timeout: 30_000 })
}

async function selectScenarioTab(example: Locator, tabName: string): Promise<void> {
  await example.getByRole('tab', { name: tabName, exact: true }).click()
}

async function expectPreviewObject(preview: Locator, expected: unknown): Promise<void> {
  await expect.poll(async () => JSON.parse((await preview.textContent())!)).toMatchObject(expected)
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
  await scope.locator('.el-input-number input').fill(String(values.inputNumber))
  await scope.getByPlaceholder(`${prefix} 自动完成`).fill(values.autocomplete)

  await scope.getByTestId(`${prefix}-select`).click()
  await chooseElementOption(page, `${optionLabel} 启用`)
  await scope.getByTestId(`${prefix}-select-v2`).click()
  await chooseElementOption(page, `${optionLabel} 大型`)

  await scope.locator('.el-cascader').click()
  await clickVisibleText(page, `${optionLabel} 华东`)
  await clickVisibleText(page, `${optionLabel} 上海`)
  await scope.getByText(`${optionLabel} 开启`, { exact: true }).click()
  await scope.getByText(`${optionLabel} 邮件`, { exact: true }).click()
  await scope.getByTestId(`${prefix}-switch`).click()
  await scope.getByText('企业', { exact: true }).click()
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
  await scope.locator('.ant-input-number input').fill(String(values.inputNumber))
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
  await expect(scope.locator('.ant-picker')).toHaveCount(4)

  return { values }
}

async function fillShadcnKnownControls(_page: Page, scope: Locator, prefix: string): Promise<FieldExpectation> {
  const optionLabel = getOptionLabel(prefix)
  const values = {
    checkbox: true,
    input: `${prefix} 文本`,
    nativeSelect: `${optionLabel}-enabled`,
    radio: 'enterprise',
    switchValue: true,
    textarea: `${prefix} 多行内容`,
  }

  await scope.getByTestId(`${prefix}-input`).fill(values.input)
  await scope.getByTestId(`${prefix}-native-select`).selectOption(values.nativeSelect)
  await scope.getByTestId(`${prefix}-textarea`).fill(values.textarea)
  await scope.getByTestId(`${prefix}-checkbox`).click()
  await scope.getByTestId(`${prefix}-switch`).click()
  await scope.getByTestId(`${prefix}-radio`).getByRole('radio', { name: '企业', exact: true }).click()

  return { values }
}

test.describe('ConfigForm playground 布局场景', () => {
  for (const suite of suites) {
    test(`${suite.libraryTabName} 通过 switch 切换 inline/grid 并覆盖已知组件`, async ({ page }) => {
      await openPlayground(page)
      const example = await openConfigFormExample(page, suite)

      await expect(example.getByTestId(`${suite.id}-layout-mode-label`)).toContainText('inline')
      await expect(example.getByTestId(`${suite.id}-layout-inline`)).toBeVisible()

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
    test(`${suite.libraryTabName} Card 容器 tab 不生成 FormItem 且覆盖已知组件`, async ({ page }) => {
      await openPlayground(page)
      const example = await openConfigFormExample(page, suite)

      await selectScenarioTab(example, '容器')
      const scenario = example.getByTestId(`${suite.id}-container-scenario`)
      const containerNode = scenario.getByTestId(`${suite.id}-container-node`)

      await expect(containerNode).toBeVisible()
      await expect(containerNode).toHaveClass(suite.containerClassPattern)
      await expect(containerNode.locator(suite.formItemSelector)).toHaveCount(0)

      const expected = await suite.fillKnownControls(page, containerNode, `${suite.id}-container`)
      await scenario.getByTestId(`${suite.id}-container-submit`).click()
      await expectPreviewObject(scenario.getByTestId(`${suite.id}-container-preview`), expected.values)
    })
  }
})

test.describe('ConfigForm playground 联动场景', () => {
  for (const suite of suites) {
    test(`${suite.libraryTabName} 联动 tab 展开后覆盖已知组件`, async ({ page }) => {
      await openPlayground(page)
      const example = await openConfigFormExample(page, suite)

      await selectScenarioTab(example, '联动')
      const scenario = example.getByTestId(`${suite.id}-linked-scenario`)

      await expect(scenario.getByTestId(suite.linkedProbeTestId)).toBeHidden()
      await scenario.getByTestId(`${suite.id}-linked-advanced-switch`).click()
      await expect(scenario.getByTestId(suite.linkedProbeTestId)).toBeVisible()

      const expected = await suite.fillKnownControls(page, scenario, `${suite.id}-linked`)
      await scenario.getByTestId(`${suite.id}-linked-submit`).click()
      await expectPreviewObject(scenario.getByTestId(`${suite.id}-linked-preview`), {
        advanced: true,
        ...expected.values,
      })
    })
  }
})

test('ConfigForm 示例用 Element Tabs 切换三套 UI 库', async ({ page }) => {
  await openPlayground(page)
  await page.getByRole('menuitem', { name: 'ConfigForm', exact: true }).click()

  const libraryTabs = page.getByTestId('config-form-library-tabs')

  for (const suite of suites) {
    await libraryTabs.getByRole('tab', { name: suite.libraryTabName, exact: true }).click()
    await expect(page.getByTestId(suite.rootTestId)).toBeVisible()
  }
})
