import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

type SuiteId = 'element' | 'antd' | 'shadcn'
type ExpectedValues = Record<string, unknown>

interface FieldExpectation {
  values: ExpectedValues
}

interface ContainerExpectation {
  classPattern: RegExp
  fieldPrefix: string
  layoutSelector: string
  testId: string
}

interface ConfigFormSuite {
  containerNodes: ContainerExpectation[]
  id: SuiteId
  knownControlSuffixes: string[]
  libraryTabName: string
  rootTestId: string
  fieldShellSelector: string
  linkedAdvancedProbeTestId: string
  fillKnownControls: (page: Page, scope: Locator, prefix: string) => Promise<FieldExpectation>
  setLinkedNotifyChannel: (page: Page, scenario: Locator) => Promise<void>
  setLinkedSeatCount: (scenario: Locator) => Promise<void>
}

interface KnownControlFallback {
  placeholder?: (prefix: string) => string
  selector?: string
  text?: string
}

interface DesignerPreviewSignature {
  cards: number
  fields: Array<{
    control: string
    field: string
    label: string
    required: boolean
  }>
  sections: number
}

const suites: ConfigFormSuite[] = [
  {
    containerNodes: [
      { classPattern: /el-card/, fieldPrefix: 'element-container', layoutSelector: '.config-form-demo__container', testId: 'element-container-node' },
      { classPattern: /el-collapse/, fieldPrefix: 'element-container-collapse', layoutSelector: '.el-collapse-item__content', testId: 'element-container-collapse-node' },
      { classPattern: /el-tabs/, fieldPrefix: 'element-container-tabs-base', layoutSelector: '.el-tab-pane', testId: 'element-container-tabs-node' },
    ],
    fillKnownControls: fillElementKnownControls,
    fieldShellSelector: '.mx-element-config-form__field',
    id: 'element',
    knownControlSuffixes: [
      'input',
      'textarea',
      'input-number',
      'autocomplete',
      'select',
      'select-v2',
      'cascader',
      'tree-select',
      'checkbox',
      'checkbox-group',
      'switch',
      'radio',
      'rate',
      'slider',
      'color',
      'date',
      'time',
      'time-select',
    ],
    libraryTabName: 'Element',
    linkedAdvancedProbeTestId: 'element-linked-select',
    rootTestId: 'element-config-form-example',
    setLinkedNotifyChannel: setElementLinkedNotifyChannel,
    setLinkedSeatCount: setElementLinkedSeatCount,
  },
  {
    containerNodes: [
      { classPattern: /ant-card/, fieldPrefix: 'antd-container', layoutSelector: '.ant-card-body', testId: 'antd-container-node' },
      { classPattern: /ant-collapse/, fieldPrefix: 'antd-container-collapse', layoutSelector: '.ant-collapse-content-box', testId: 'antd-container-collapse-node' },
      { classPattern: /ant-tabs/, fieldPrefix: 'antd-container-tabs-base', layoutSelector: '.ant-tabs-tabpane-active', testId: 'antd-container-tabs-node' },
    ],
    fillKnownControls: fillAntdKnownControls,
    fieldShellSelector: '.mx-antd-config-form__field',
    id: 'antd',
    knownControlSuffixes: [
      'input',
      'textarea',
      'password',
      'search',
      'input-number',
      'auto-complete',
      'select',
      'cascader',
      'tree-select',
      'checkbox',
      'checkbox-group',
      'switch',
      'radio',
      'rate',
      'slider',
      'date',
      'range',
      'time',
      'time-range',
    ],
    libraryTabName: 'Antd',
    linkedAdvancedProbeTestId: 'antd-linked-select',
    rootTestId: 'antd-config-form-example',
    setLinkedNotifyChannel: setAntdLinkedNotifyChannel,
    setLinkedSeatCount: setAntdLinkedSeatCount,
  },
  {
    containerNodes: [
      { classPattern: /shadcn-card/, fieldPrefix: 'shadcn-container', layoutSelector: '.shadcn-card__body', testId: 'shadcn-container-node' },
      { classPattern: /shadcn-accordion/, fieldPrefix: 'shadcn-container-accordion', layoutSelector: '.shadcn-accordion__body', testId: 'shadcn-container-accordion-node' },
      { classPattern: /shadcn-tabs-container/, fieldPrefix: 'shadcn-container-tabs-base', layoutSelector: '.shadcn-tab-pane', testId: 'shadcn-container-tabs-node' },
    ],
    fillKnownControls: fillShadcnKnownControls,
    fieldShellSelector: '.mx-shadcn-config-form__field',
    id: 'shadcn',
    knownControlSuffixes: [
      'input',
      'password',
      'search',
      'combobox',
      'native-select',
      'input-number',
      'slider',
      'date',
      'time',
      'color',
      'textarea',
      'checkbox',
      'switch',
      'radio',
    ],
    libraryTabName: 'Shadcn',
    linkedAdvancedProbeTestId: 'shadcn-linked-native-select',
    rootTestId: 'shadcn-config-form-example',
    setLinkedNotifyChannel: setShadcnLinkedNotifyChannel,
    setLinkedSeatCount: setShadcnLinkedSeatCount,
  },
]

const knownControlFallbackSelectors: Partial<Record<SuiteId, Record<string, KnownControlFallback>>> = {
  antd: {
    'date': { placeholder: prefix => `${prefix} 日期` },
    'range': { placeholder: prefix => `${prefix} 开始日期` },
    'slider': { selector: '.ant-slider' },
    'time': { placeholder: prefix => `${prefix} 时间` },
    'time-range': { placeholder: prefix => `${prefix} 开始时间` },
  },
  element: {
    'cascader': { selector: '.el-cascader' },
    'date': { placeholder: prefix => `${prefix} 日期` },
    'time': { placeholder: prefix => `${prefix} 时间` },
    'time-select': { text: '09:00' },
  },
}

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

async function readDesignerPreviewSignature(preview: Locator): Promise<DesignerPreviewSignature> {
  return preview.locator('form').evaluate((form) => {
    const fields = [...form.querySelectorAll<HTMLElement>('[data-field]')].map(field => ({
      control: field.querySelector('.mx-config-form__control')?.firstElementChild?.getAttribute('class') || '',
      field: field.dataset.field || '',
      label: field.querySelector('.mx-config-form__label')?.textContent?.trim() || '',
      required: field.dataset.required === 'true',
    }))

    return {
      cards: form.querySelectorAll('.el-card').length,
      fields,
      sections: form.querySelectorAll('.mx-element-designer-section').length,
    }
  })
}

async function dragSortableItem(
  page: Page,
  source: Locator,
  target: Locator,
  approach: 'horizontal' | 'vertical' = 'horizontal',
): Promise<void> {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox)
    throw new Error('Sortable source or target is not visible')

  const sourceX = sourceBox.x + sourceBox.width / 2
  const sourceY = sourceBox.y + sourceBox.height / 2
  await page.mouse.move(sourceX, sourceY)
  await page.mouse.down()
  await page.mouse.move(sourceX + 12, sourceY + 12, { steps: 4 })
  await page.waitForTimeout(50)
  const draggable = source.locator('xpath=ancestor-or-self::*[@data-designer-draggable][1]')
  await expect(draggable.first()).toHaveClass(/sortable-chosen/)
  const targetX = targetBox.x + targetBox.width / 2
  const targetY = approach === 'vertical'
    ? targetBox.y + targetBox.height - 6
    : targetBox.y + targetBox.height - 12
  if (approach === 'vertical') {
    await page.mouse.move(targetX, targetY + 12, { steps: 24 })
    await page.mouse.move(targetX, targetY, { steps: 8 })
  }
  else {
    await page.mouse.move(sourceX + 12, targetY, { steps: 12 })
    await page.mouse.move(targetX, targetY, { steps: 18 })
  }
  await page.waitForTimeout(200)
  await page.mouse.up()
}

async function expectInlineVisualSpacing(example: Locator, suite: ConfigFormSuite): Promise<void> {
  const row = example.locator(`#${suite.id}-layout-inline-row`)

  await expect(row).toBeVisible()

  const metrics = await row.evaluate((element, fieldShellSelector) => {
    const rect = element.getBoundingClientRect()
    const styles = getComputedStyle(element)
    const firstItem = element.querySelector(fieldShellSelector)
    const firstItemStyles = firstItem ? getComputedStyle(firstItem) : undefined

    return {
      display: styles.display,
      flexWrap: styles.flexWrap,
      firstItemMarginBottom: firstItemStyles ? Number.parseFloat(firstItemStyles.marginBottom) : 0,
      firstItemMarginRight: firstItemStyles ? Number.parseFloat(firstItemStyles.marginRight) : 0,
      marginLeft: Number.parseFloat(styles.marginLeft),
      rowGap: Number.parseFloat(styles.rowGap),
      x: rect.x,
    }
  }, suite.fieldShellSelector)

  expect(metrics.display).toBe('flex')
  expect(metrics.flexWrap).toBe('wrap')
  expect(metrics.marginLeft).toBeGreaterThanOrEqual(0)
  expect(metrics.x).toBeGreaterThanOrEqual(0)
  expect(metrics.rowGap).toBeGreaterThanOrEqual(14)
  if (suite.id === 'element') {
    expect(metrics.firstItemMarginRight).toBeLessThanOrEqual(16)
    expect(metrics.firstItemMarginBottom).toBeLessThanOrEqual(12)
  }
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

async function expectKnownControlsVisible(scope: Locator, suite: ConfigFormSuite, prefix: string): Promise<void> {
  for (const suffix of suite.knownControlSuffixes) {
    const fallbackSelector = knownControlFallbackSelectors[suite.id]?.[suffix]
    const locator = fallbackSelector?.placeholder
      ? scope.getByPlaceholder(fallbackSelector.placeholder(prefix))
      : fallbackSelector?.selector
        ? scope.locator(fallbackSelector.selector)
        : fallbackSelector?.text
          ? scope.getByText(fallbackSelector.text, { exact: true })
          : scope.getByTestId(`${prefix}-${suffix}`)
    const locatorCount = await locator.count()

    expect(locatorCount, `${suite.libraryTabName} ${prefix}-${suffix}`).toBeGreaterThan(0)
    await expect(locator.first(), `${suite.libraryTabName} ${prefix}-${suffix}`).toBeVisible()
  }
}

function getOptionLabel(prefix: string): string {
  return prefix.replace(/^(element|antd|shadcn)-/, '')
}

async function clickVisibleText(page: Page, text: string): Promise<void> {
  const target = page.getByText(text, { exact: true }).filter({ visible: true }).last()

  await expect(target).toBeVisible()
  await target.click()
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

async function chooseElementLinkedSelectOption(page: Page, select: Locator, optionName: string): Promise<void> {
  const option = page.locator('.el-select-dropdown__item', { hasText: optionName }).filter({ visible: true }).last()

  await select.click()
  await expect(option).toBeVisible()
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
  const checkbox = scope.getByTestId(`${prefix}-checkbox`)

  await checkbox.locator('.el-checkbox__label').click()
  await expect(checkbox.locator('input[type="checkbox"]')).toBeChecked()
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
    color: '#16a34a',
    combobox: `${optionLabel}-enabled`,
    date: '2026-06-02',
    input: `${prefix} 文本`,
    inputNumber: 42,
    nativeSelect: `${optionLabel}-enabled`,
    password: `${prefix} 密码`,
    radio: 'enterprise',
    search: `${prefix} 搜索`,
    slider: 10,
    switchValue: true,
    textarea: `${prefix} 多行内容`,
    time: '10:30',
  }

  await scope.getByTestId(`${prefix}-input`).fill(values.input)
  await scope.getByTestId(`${prefix}-password`).fill(values.password)
  await scope.getByTestId(`${prefix}-search`).fill(values.search)
  await scope.getByTestId(`${prefix}-combobox`).locator('input').fill(values.combobox)
  await scope.getByTestId(`${prefix}-native-select`).selectOption(values.nativeSelect)
  await scope.getByTestId(`${prefix}-input-number`).fill(String(values.inputNumber))
  await expect(scope.getByTestId(`${prefix}-slider`)).toBeVisible()
  await scope.getByTestId(`${prefix}-date`).fill(values.date)
  await scope.getByTestId(`${prefix}-time`).fill(values.time)
  await scope.getByTestId(`${prefix}-color`).evaluate((element, color) => {
    const input = element as HTMLInputElement

    input.value = color
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, values.color)
  await scope.getByTestId(`${prefix}-textarea`).fill(values.textarea)
  await scope.getByTestId(`${prefix}-checkbox`).click()
  await scope.getByTestId(`${prefix}-switch`).click()
  await scope.getByTestId(`${prefix}-radio`).getByRole('radio', { name: '企业', exact: true }).click()

  return { values }
}

async function setElementLinkedNotifyChannel(page: Page, scenario: Locator): Promise<void> {
  await chooseElementLinkedSelectOption(page, scenario.getByTestId('element-linked-notify-channel'), '预约通知')
}

async function setElementLinkedSeatCount(scenario: Locator): Promise<void> {
  await scenario.getByTestId('element-linked-seat-count').locator('input').fill('8')
}

async function setAntdLinkedNotifyChannel(page: Page, scenario: Locator): Promise<void> {
  await scenario.getByTestId('antd-linked-notify-channel').click()
  await chooseAntdOption(page, '预约通知')
}

async function setAntdLinkedSeatCount(scenario: Locator): Promise<void> {
  await scenario.getByTestId('antd-linked-seat-count').fill('8')
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

  test('Element 布局场景渲染 200 个字段并可提交', async ({ page }) => {
    await openPlayground(page)
    const example = await openConfigFormExample(page, suites[0]!)
    const stressScenario = example.getByTestId('element-layout-stress')
    const stressForm = stressScenario.getByTestId('element-layout-stress-form')

    await expect(stressScenario.getByTestId('element-layout-stress-count')).toContainText('200 fields')
    await expect(stressForm.locator('.mx-element-config-form__field')).toHaveCount(200)

    await stressForm.getByTestId('element-layout-stress-input-1').fill('性能字段 1')
    await stressForm.getByTestId('element-layout-stress-input-200').fill('性能字段 200')
    await stressScenario.getByTestId('element-layout-stress-submit').click()

    await expectPreviewObject(stressScenario.getByTestId('element-layout-stress-preview'), {
      count: 200,
      sample: {
        stressField1: '性能字段 1',
        stressField200: '性能字段 200',
      },
      submitted: 200,
    })
  })
})

test.describe('ConfigForm playground 容器场景', () => {
  for (const suite of suites) {
    test(`${suite.libraryTabName} 多容器 tab 不生成字段壳且覆盖已知组件`, async ({ page }) => {
      await openPlayground(page)
      const example = await openConfigFormExample(page, suite)

      await selectScenarioTab(example, '容器')
      const scenario = example.getByTestId(`${suite.id}-container-scenario`)
      const primaryContainerNode = suite.containerNodes[0]!

      for (const containerNodeExpectation of suite.containerNodes) {
        const containerNode = scenario.getByTestId(containerNodeExpectation.testId)

        await expect(containerNode).toBeVisible()
        await expect(containerNode).toHaveClass(containerNodeExpectation.classPattern)
        await expect(containerNode).not.toHaveClass(new RegExp(`${suite.fieldShellSelector.slice(1)}(?:\\s|$)`))
        await expectContainerVisualSpacing(containerNode, containerNodeExpectation.layoutSelector)
        if (containerNodeExpectation.testId === primaryContainerNode.testId)
          await expectKnownControlsVisible(containerNode, suite, containerNodeExpectation.fieldPrefix)
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
      await expect(scenario.getByTestId(`${suite.id}-linked-enterprise-name-readonly`)).toContainText(`${suite.id} 企业名称`)
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

test.describe('ConfigForm visual designer', () => {
  test('supports controlled editing, nested movement, history, export/import and preview', async ({ page }) => {
    await openPlayground(page)

    const libraryTabs = page.getByTestId('config-form-library-tabs')
    await libraryTabs.getByRole('tab', { name: 'Designer', exact: true }).click()

    const example = page.getByTestId('designer-example')
    const canvas = example.getByLabel('Form canvas')
    const palette = example.getByLabel('Materials')
    const properties = example.getByLabel('Properties')
    const toolbar = example.getByRole('toolbar', { name: 'Designer commands' })

    await expect(example).toBeVisible()
    await expect(canvas.locator('[data-node-id]')).toHaveCount(5)
    await expect(canvas.locator('input[placeholder="Your name"]')).toBeVisible()
    await expect(canvas.locator('.mx-config-form-designer__node-preview-label').first()).toHaveText('Name')
    const canvasLabelStyle = await canvas.locator('.mx-config-form-designer__node-preview-label').first().evaluate((element) => {
      const styles = getComputedStyle(element)
      return { clipPath: styles.clipPath, position: styles.position, width: styles.width }
    })
    expect(canvasLabelStyle.position).toBe('static')
    expect(canvasLabelStyle.clipPath).toBe('none')
    expect(canvasLabelStyle.width).not.toBe('1px')

    const columnsSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Columns' })
    await columnsSetter.getByRole('button', { name: 'Increase Columns', exact: true }).click()
    await expect(columnsSetter.getByRole('spinbutton', { name: 'Columns' })).toHaveValue('3')
    await columnsSetter.getByRole('button', { name: 'Decrease Columns', exact: true }).click()
    await expect(columnsSetter.getByRole('spinbutton', { name: 'Columns' })).toHaveValue('2')

    const inlineSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Inline' })
    const inlineSwitch = inlineSetter.getByRole('switch')
    await inlineSwitch.click()
    await expect(inlineSwitch).toHaveAttribute('aria-checked', 'true')
    await inlineSwitch.click()

    const labelPositionSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Label position' })
    await labelPositionSetter.getByRole('button', { name: 'Top', exact: true }).click()
    await expect(canvas.locator('.mx-config-form-designer__node-preview.is-label-top')).toHaveCount(3)
    await labelPositionSetter.getByRole('button', { name: 'Left', exact: true }).click()
    await expect(canvas.locator('.mx-config-form-designer__node-preview.is-label-left')).toHaveCount(3)

    const enabledInitialNode = canvas.locator('[data-node-id="designer-enabled"]')
    const unselectedBox = await enabledInitialNode.boundingBox()
    const unselectedOverlay = await enabledInitialNode.evaluate(element => getComputedStyle(element, '::after').content)
    expect(unselectedOverlay).toBe('none')
    await enabledInitialNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    const selectedBox = await enabledInitialNode.boundingBox()
    expect(selectedBox?.width).toBeCloseTo(unselectedBox!.width, 1)
    expect(selectedBox?.height).toBeCloseTo(unselectedBox!.height, 1)
    const overlayStyle = await enabledInitialNode.evaluate((element) => {
      const styles = getComputedStyle(element, '::after')
      return {
        borderStyle: styles.borderStyle,
        pointerEvents: styles.pointerEvents,
        top: styles.top,
        right: styles.right,
        bottom: styles.bottom,
        left: styles.left,
      }
    })
    expect(overlayStyle).toEqual({
      borderStyle: 'dashed',
      pointerEvents: 'none',
      top: '-5px',
      right: '-5px',
      bottom: '-5px',
      left: '-5px',
    })
    const nodeToolbarBox = await enabledInitialNode.locator(':scope > .mx-config-form-designer__node-header').boundingBox()
    await expect(enabledInitialNode.locator(':scope > .mx-config-form-designer__node-header > .mx-config-form-designer__node-actions [data-drag-handle]')).toBeVisible()
    expect(nodeToolbarBox!.height).toBeLessThanOrEqual(28)
    expect(Math.abs(nodeToolbarBox!.y + nodeToolbarBox!.height - (selectedBox!.y - 5))).toBeLessThanOrEqual(1)
    expect(Math.abs(nodeToolbarBox!.x + nodeToolbarBox!.width - (selectedBox!.x + selectedBox!.width + 5))).toBeLessThanOrEqual(1)

    const choiceNode = canvas.locator('[data-node-id="designer-choice"]')
    await choiceNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    const choiceToolbar = choiceNode.locator(':scope > .mx-config-form-designer__node-header')
    const choiceToolbarStyle = await choiceToolbar.evaluate(element => ({
      zIndex: Number(getComputedStyle(element).zIndex),
      cardBodyOverflow: getComputedStyle(element.closest('.el-card__body')!).overflow,
    }))
    expect(choiceToolbarStyle.zIndex).toBeGreaterThanOrEqual(100)
    expect(choiceToolbarStyle.cardBodyOverflow).toBe('visible')
    const choiceToolbarHit = await choiceToolbar.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('button')?.getAttribute('aria-label')
    })
    expect(choiceToolbarHit).toBeTruthy()
    const optionsSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Options' })
    await expect(optionsSetter.locator('.mx-config-form-designer__collection-row')).toHaveCount(2)
    await expect(optionsSetter.locator('textarea')).toHaveCount(0)
    await optionsSetter.getByRole('button', { name: 'Add option', exact: true }).click()
    await optionsSetter.getByRole('button', { name: 'Delete option 3', exact: true }).click()

    await dragSortableItem(
      page,
      palette.getByRole('button', { name: 'Input', exact: true }),
      canvas.locator('.mx-config-form-designer__node-list[data-parent-id=""]').first(),
    )
    await expect(canvas.locator('[data-node-id]')).toHaveCount(6)

    const selectedNode = canvas.locator('.mx-config-form-designer__node.is-selected')
    await expect(selectedNode).toHaveCount(1)
    const labelInput = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Label' }).locator('input').first()
    await labelInput.fill('Email')
    await labelInput.blur()
    await expect(selectedNode.locator('.mx-config-form-designer__node-preview-label')).toHaveText('Email')

    await properties.getByRole('tab', { name: 'Validation', exact: true }).click()
    const validationSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Rules' })
    await validationSetter.getByRole('switch', { name: 'Enable validation' }).click()
    await validationSetter.getByRole('button', { name: 'Add rule', exact: true }).click()
    await validationSetter.getByRole('combobox', { name: 'Rule 1 type' }).selectOption('email')
    await validationSetter.getByRole('textbox', { name: 'Rule 1 message' }).fill('Enter a valid email')
    await validationSetter.getByRole('textbox', { name: 'Rule 1 message' }).blur()
    await expect(validationSetter.locator('textarea')).toHaveCount(0)

    await properties.getByRole('tab', { name: 'Conditions', exact: true }).click()
    const requiredSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Required' })
    await requiredSetter.getByRole('button', { name: 'Always', exact: true }).click()
    await expect(requiredSetter.locator('textarea')).toHaveCount(0)

    const enabledNode = canvas.locator('[data-node-id="designer-enabled"]')
    await enabledNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await dragSortableItem(
      page,
      enabledNode.getByRole('button', { name: 'Move node', exact: true }),
      canvas.locator('.mx-config-form-designer__node-list[data-parent-id="designer-card"]'),
      'vertical',
    )
    await expect(canvas.locator('[data-node-id="designer-card"] [data-node-id="designer-enabled"]')).toBeVisible()

    await toolbar.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(canvas.locator('[data-node-id="designer-card"] [data-node-id="designer-enabled"]')).toHaveCount(0)
    await toolbar.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(canvas.locator('[data-node-id="designer-card"] [data-node-id="designer-enabled"]')).toBeVisible()

    await toolbar.getByRole('button', { name: 'Export document', exact: true }).click()
    const exportDialog = example.getByRole('dialog', { name: 'Export document' })
    const exported = await exportDialog.locator('textarea').inputValue()
    const exportedDocument = JSON.parse(exported)
    const exportedEmail = exportedDocument.nodes.find((node: { label?: string }) => node.label === 'Email')
    expect(exportedDocument.version).toBe(1)
    expect(exportedDocument.form.labelPosition).toBe('left')
    expect(exportedEmail).toMatchObject({
      material: 'element.input',
      field: 'input',
      label: 'Email',
      validation: {
        version: 1,
        base: { type: 'string' },
        rules: [{ kind: 'email', message: 'Enter a valid email' }],
      },
      conditions: {
        required: { kind: 'literal', value: true },
      },
    })
    await exportDialog.getByRole('button', { name: 'Close', exact: true }).click()

    await toolbar.getByRole('button', { name: 'Preview form', exact: true }).click()
    const previewDialog = example.getByRole('dialog', { name: 'Form preview' })
    await expect(previewDialog).toContainText('Email')
    await expect(previewDialog).toContainText('Choice')
    const exportedPreviewSignature = await readDesignerPreviewSignature(previewDialog)
    expect(exportedPreviewSignature).toMatchObject({
      cards: 1,
      sections: 1,
      fields: expect.arrayContaining([
        expect.objectContaining({ field: 'input', label: 'Email', required: true }),
        expect.objectContaining({ field: 'choice', label: 'Choice' }),
      ]),
    })
    await previewDialog.getByRole('button', { name: 'Close preview', exact: true }).click()

    await toolbar.getByRole('button', { name: 'Import document', exact: true }).click()
    const importDialog = example.getByRole('dialog', { name: 'Import document' })
    await importDialog.locator('textarea').fill(exported)
    await importDialog.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(example.locator('.mx-config-form-designer__status')).toContainText('Ready')

    const emailFocusTarget = canvas.locator(`[data-focus-node-id="${exportedEmail.id}"]`)
    const rootNodes = canvas.locator('.mx-config-form-designer__node-list[data-parent-id=""]').first().locator(':scope > [data-node-id]')
    await emailFocusTarget.click()
    await emailFocusTarget.press('ArrowUp')
    await expect(rootNodes.nth(1)).toContainText('Email')
    await expect(emailFocusTarget).toBeFocused()
    await emailFocusTarget.press('ArrowDown')
    await expect(rootNodes.nth(2)).toContainText('Email')
    await expect(emailFocusTarget).toBeFocused()

    await toolbar.getByRole('button', { name: 'Preview form', exact: true }).click()
    const importedPreview = example.getByRole('dialog', { name: 'Form preview' })
    await expect(importedPreview).toContainText('Email')
    await expect(importedPreview).toContainText('Choice')
    expect(await readDesignerPreviewSignature(importedPreview)).toEqual(exportedPreviewSignature)
  })
})
