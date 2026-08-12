import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

type SuiteId = 'element' | 'antd'
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
    const fields = [...form.querySelectorAll<HTMLElement>('[data-field]')].map((field) => {
      const fieldClass = [...field.classList].find(className => className.endsWith('__field'))
      const namespace = fieldClass?.slice(0, -'__field'.length)
      const control = namespace ? field.querySelector(`.${CSS.escape(namespace)}__control`) : null
      const label = namespace ? field.querySelector(`.${CSS.escape(namespace)}__label`) : null

      return {
        control: control?.firstElementChild?.getAttribute('class') || '',
        field: field.dataset.field || '',
        label: label?.textContent?.trim() || '',
        required: field.dataset.required === 'true',
      }
    })

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

async function inspectSortableDrag(
  page: Page,
  source: Locator,
  duringDrag: () => Promise<void>,
): Promise<void> {
  const sourceBox = await source.boundingBox()
  if (!sourceBox)
    throw new Error('Sortable source is not visible')

  const sourceX = sourceBox.x + sourceBox.width / 2
  const sourceY = sourceBox.y + sourceBox.height / 2
  await page.mouse.move(sourceX, sourceY)
  await page.mouse.down()
  await page.mouse.move(sourceX + 12, sourceY + 12, { steps: 4 })
  await page.waitForTimeout(50)
  const draggable = source.locator('xpath=ancestor-or-self::*[@data-designer-draggable][1]')
  await expect(draggable.first()).toHaveClass(/sortable-chosen/)
  await duringDrag()
  await page.mouse.move(sourceX, sourceY, { steps: 4 })
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

async function expectSingleSelectionFrameMatchesNode(node: Locator): Promise<void> {
  await expect(node).toHaveClass(/is-selected/)
  await expect(node.locator(':scope > .mx-config-form-designer__node-actions')).toBeVisible()
  const metrics = await node.evaluate((element) => {
    const frame = getComputedStyle(element, '::after')
    return {
      borderStyle: frame.borderStyle,
      bottom: frame.bottom,
      left: frame.left,
      pointerEvents: frame.pointerEvents,
      right: frame.right,
      top: frame.top,
      oldFrameCount: element.querySelectorAll('.mx-config-form-designer__selection-overlay, [data-designer-span-footprint]').length,
    }
  })

  expect(metrics).toEqual({
    borderStyle: 'dashed',
    bottom: '-5px',
    left: '-5px',
    oldFrameCount: 0,
    pointerEvents: 'none',
    right: '-5px',
    top: '-5px',
  })
}

async function expectQuietEmptySlot(list: Locator): Promise<Locator> {
  const emptySlot = list.locator(':scope > .mx-config-form-designer__empty-slot')
  await expect(emptySlot).toHaveCount(1)
  expect(await emptySlot.evaluate((element) => {
    const styles = getComputedStyle(element)
    const icon = element.querySelector<HTMLElement>(':scope > .mx-config-form-designer__empty-slot-icon')!
    const iconStyles = getComputedStyle(icon)
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderTopColor,
      borderStyle: styles.borderTopStyle,
      childCount: element.children.length,
      hasIcon: Boolean(element.querySelector(':scope > .mx-config-form-designer__empty-slot-icon > svg')),
      iconBorderStyle: iconStyles.borderTopStyle,
      text: element.textContent?.trim() ?? '',
    }
  })).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderColor: 'rgba(0, 0, 0, 0)',
    borderStyle: 'solid',
    childCount: 1,
    hasIcon: true,
    iconBorderStyle: 'none',
    text: '',
  })
  return emptySlot
}

async function expectNativeNestedFlow(list: Locator): Promise<void> {
  expect(await list.evaluate((element) => {
    const styles = getComputedStyle(element)
    return {
      borderStyle: styles.borderTopStyle,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
      paddingTop: styles.paddingTop,
    }
  })).toEqual({
    borderStyle: 'none',
    paddingBottom: '0px',
    paddingLeft: '0px',
    paddingRight: '0px',
    paddingTop: '0px',
  })
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
  return prefix.replace(/^(element|antd)-/, '')
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
        : scenario.getByTestId(`${suite.id}-linked-scheduled-time`)

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

    const rootList = canvas.locator('.mx-config-form-designer__node-list[data-parent-id=""]').first()
    await expect.poll(() => rootList.evaluate(element => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      display: getComputedStyle(element).display,
      gap: getComputedStyle(element).gap,
    }))).toEqual({ columns: 24, display: 'grid', gap: '16px' })

    const formFields = properties.locator('.mx-config-form-designer__property-fields')
    const formSetters = formFields.locator('.mx-config-form-designer-property-form__field.is-simple')
    const horizontalSetter = formSetters.filter({ hasText: 'Columns' })
    expect(await horizontalSetter.evaluate((element) => {
      const label = element.querySelector<HTMLElement>(':scope > .mx-config-form-designer-property-form__label')!
      const control = element.querySelector<HTMLElement>(':scope > .mx-config-form-designer-property-form__control')!
      const labelBox = label.getBoundingClientRect()
      const controlBox = control.getBoundingClientRect()
      return {
        columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
        controlWidth: controlBox.width,
        labelBeforeControl: labelBox.right <= controlBox.left,
      }
    })).toMatchObject({ columns: 2, labelBeforeControl: true })
    await expect(horizontalSetter.locator('.el-input-number')).toBeVisible()
    expect(await horizontalSetter.locator('.mx-config-form-designer-property-form__control').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(150)
    const responsiveSettings = properties.getByLabel('Responsive layout')
    const tabletSettings = responsiveSettings.locator('.mx-config-form-designer__responsive-breakpoint').filter({ hasText: 'Tablet' })
    await expect(tabletSettings.getByRole('switch', { name: 'Tablet layout', exact: true })).toHaveAttribute('aria-checked', 'true')
    await canvas.getByRole('button', { name: 'Tablet', exact: true }).click()
    await expect.poll(() => rootList.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(12)

    const mobileSettings = responsiveSettings.locator('.mx-config-form-designer__responsive-breakpoint').filter({ hasText: 'Mobile' })
    await expect(mobileSettings.getByRole('switch', { name: 'Mobile layout', exact: true })).toHaveAttribute('aria-checked', 'true')
    await canvas.getByRole('button', { name: 'Mobile', exact: true }).click()
    await expect.poll(() => rootList.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1)
    await canvas.getByRole('button', { name: 'Desktop', exact: true }).click()
    await expect.poll(() => rootList.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(24)

    const columnsSetter = formSetters.filter({ hasText: 'Columns' })
    const columnsInput = columnsSetter.getByRole('spinbutton', { name: 'Columns', exact: true })
    await columnsInput.fill('23')
    await columnsInput.blur()
    await expect(columnsInput).toHaveValue('23')
    await expect.poll(() => rootList.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(23)
    await columnsInput.fill('24')
    await columnsInput.blur()
    await expect(columnsInput).toHaveValue('24')

    const gapSetter = formSetters.filter({ hasText: 'Gap' })
    await gapSetter.getByRole('textbox', { name: 'Gap' }).fill('20px')
    await gapSetter.getByRole('textbox', { name: 'Gap' }).blur()
    await expect.poll(() => rootList.evaluate(element => getComputedStyle(element).gap)).toBe('20px')
    await toolbar.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => rootList.evaluate(element => getComputedStyle(element).gap)).toBe('16px')
    await toolbar.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect.poll(() => rootList.evaluate(element => getComputedStyle(element).gap)).toBe('20px')

    const fieldSpanSetter = formSetters.filter({ hasText: 'Field span' })
    const fieldSpanInput = fieldSpanSetter.getByRole('spinbutton', { name: 'Field span', exact: true })
    await fieldSpanInput.fill('23')
    await fieldSpanInput.blur()
    await expect.poll(() => canvas.locator('[data-node-id="designer-enabled"]').evaluate(element => getComputedStyle(element).gridColumnEnd)).toBe('span 23')
    await fieldSpanInput.fill('24')
    await fieldSpanInput.blur()
    await expect.poll(() => canvas.locator('[data-node-id="designer-enabled"]').evaluate(element => getComputedStyle(element).gridColumnEnd)).toBe('span 24')

    const inlineSetter = formSetters.filter({ hasText: 'Inline' })
    const inlineSwitch = inlineSetter.getByRole('switch')
    const inlineSwitchControl = inlineSetter.locator('.el-switch')
    await expect(inlineSwitchControl).toBeVisible()
    await inlineSwitchControl.click()
    await expect(inlineSwitch).toHaveAttribute('aria-checked', 'true')
    await expect.poll(() => rootList.evaluate(element => ({
      display: getComputedStyle(element).display,
      flexWrap: getComputedStyle(element).flexWrap,
    }))).toEqual({ display: 'flex', flexWrap: 'wrap' })
    await inlineSwitchControl.click()

    const labelPositionSetter = formSetters.filter({ hasText: 'Label position' })
    await expect(labelPositionSetter.locator('.el-segmented')).toBeVisible()
    await labelPositionSetter.locator('.el-segmented__item').filter({ hasText: 'Top' }).click()
    await expect(canvas.locator('.mx-config-form-designer__node-preview.is-label-top')).toHaveCount(3)
    await labelPositionSetter.locator('.el-segmented__item').filter({ hasText: 'Left' }).click()
    await expect(canvas.locator('.mx-config-form-designer__node-preview.is-label-left')).toHaveCount(3)

    const readonlySetter = formSetters.filter({ hasText: 'Readonly' })
    const readonlySwitchControl = readonlySetter.locator('.el-switch')
    await readonlySwitchControl.click()
    await expect(canvas.locator('.mx-config-form-designer__node-preview-readonly')).toHaveCount(3)
    await expect(canvas.locator('input[placeholder="Your name"]')).toHaveCount(0)
    await expect(canvas.locator('[data-node-id="designer-choice"] [role="combobox"]')).toHaveCount(0)
    const readonlyName = canvas.locator('[data-node-id="designer-name"] .mx-config-form-designer__node-preview')
    const readonlyNameAlignment = await readonlyName.evaluate((element) => {
      const label = element.querySelector('.mx-config-form-designer__node-preview-label')?.getBoundingClientRect()
      const value = element.querySelector('.mx-config-form-designer__node-preview-readonly')?.getBoundingClientRect()
      return {
        labelHeight: label?.height ?? 0,
        labelTop: label?.top ?? 0,
        valueHeight: value?.height ?? 0,
        valueTop: value?.top ?? 0,
      }
    })
    expect(Math.abs(readonlyNameAlignment.labelTop - readonlyNameAlignment.valueTop)).toBeLessThanOrEqual(1)
    expect(readonlyNameAlignment.valueHeight).toBeCloseTo(readonlyNameAlignment.labelHeight, 1)
    await readonlySwitchControl.click()

    const linkagePreview = canvas.getByRole('button', { name: 'Linkage preview', exact: true })
    await linkagePreview.click()
    await expect(linkagePreview).toHaveAttribute('aria-pressed', 'true')
    const enabledPreview = canvas.locator('[data-node-id="designer-enabled"] .el-switch')
    await enabledPreview.click()
    await expect(canvas.locator('[data-node-id="designer-choice"] [role="combobox"]')).toBeDisabled()
    await linkagePreview.click()
    await expect(canvas.locator('[data-node-id="designer-choice"] [role="combobox"]')).toBeEnabled()
    await canvas.click({ position: { x: 5, y: 5 } })

    const enabledInitialNode = canvas.locator('[data-node-id="designer-enabled"]')
    const unselectedBox = await enabledInitialNode.boundingBox()
    await expect(enabledInitialNode.locator(':scope > .mx-config-form-designer__node-actions')).toHaveCount(0)
    await enabledInitialNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    const inheritedSpan = properties.locator('.mx-config-form-designer-property-form__field.is-simple').filter({ hasText: 'Span' })
    await expect(inheritedSpan.getByRole('spinbutton', { name: 'Span', exact: true })).toHaveValue('24')
    await expect(inheritedSpan).toHaveAttribute('data-inherited-label', 'Inherited')
    await inheritedSpan.getByRole('spinbutton', { name: 'Span', exact: true }).blur()
    const selectedBox = await enabledInitialNode.boundingBox()
    expect(selectedBox?.width).toBeCloseTo(unselectedBox!.width, 1)
    expect(selectedBox?.height).toBeCloseTo(unselectedBox!.height, 1)
    await expectSingleSelectionFrameMatchesNode(enabledInitialNode)
    const nodeToolbar = enabledInitialNode.locator(':scope > .mx-config-form-designer__node-actions')
    const nodeToolbarBox = await nodeToolbar.boundingBox()
    await expect(nodeToolbar.locator('[data-drag-handle]')).toBeVisible()
    expect(nodeToolbarBox!.height).toBeLessThanOrEqual(28)
    expect(Math.abs(nodeToolbarBox!.y + nodeToolbarBox!.height - (selectedBox!.y - 5))).toBeLessThanOrEqual(1)
    expect(Math.abs(nodeToolbarBox!.x + nodeToolbarBox!.width - (selectedBox!.x + selectedBox!.width + 5))).toBeLessThanOrEqual(1)
    await inheritedSpan.getByRole('spinbutton', { name: 'Span', exact: true }).focus()
    await expect(enabledInitialNode).toHaveClass(/is-selected/)
    await expect(inheritedSpan.getByRole('spinbutton', { name: 'Span', exact: true })).toHaveValue('24')
    await expect(nodeToolbar).toBeHidden()
    await expect.poll(() => enabledInitialNode.evaluate(element => getComputedStyle(element, '::after').borderStyle)).toBe('none')
    await enabledInitialNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()

    const initialRootOrder = await rootList.locator(':scope > [data-node-id]').evaluateAll(elements => (
      elements.map(element => (element as HTMLElement).dataset.nodeId)
    ))
    const sectionNode = canvas.locator('[data-node-id="designer-section"]')
    await sectionNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expectSingleSelectionFrameMatchesNode(sectionNode)
    await dragSortableItem(
      page,
      sectionNode.locator(':scope > .mx-config-form-designer__node-actions [data-drag-handle]'),
      rootList,
      'vertical',
    )
    await expect.poll(() => rootList.locator(':scope > [data-node-id]').evaluateAll(elements => (
      elements.map(element => (element as HTMLElement).dataset.nodeId)
    ))).toEqual(['designer-card', 'designer-section', 'designer-enabled'])
    await toolbar.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => rootList.locator(':scope > [data-node-id]').evaluateAll(elements => (
      elements.map(element => (element as HTMLElement).dataset.nodeId)
    ))).toEqual(initialRootOrder)

    const choiceNode = canvas.locator('[data-node-id="designer-choice"]')
    await choiceNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    const choiceToolbar = choiceNode.locator(':scope > .mx-config-form-designer__node-actions')
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
    const defaultValueSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Default value' })
    await expect(defaultValueSetter.locator('.mx-config-form-designer__unset-button')).toHaveCount(0)
    await expect(defaultValueSetter.getByRole('button', { name: 'Playground', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await defaultValueSetter.getByRole('button', { name: 'Production', exact: true }).click()
    await expect(choiceNode).toContainText('Production')
    await toolbar.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(choiceNode).toContainText('Playground')
    await toolbar.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(choiceNode).toContainText('Production')
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
    const labelInput = properties.getByRole('textbox', { name: 'Label', exact: true })
    await labelInput.fill('Email')
    await labelInput.blur()
    await expect(selectedNode.locator('.mx-config-form-designer__node-preview-label')).toHaveText('Email')
    await toolbar.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(selectedNode.locator('.mx-config-form-designer__node-preview-label')).not.toHaveText('Email')
    await toolbar.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(selectedNode.locator('.mx-config-form-designer__node-preview-label')).toHaveText('Email')

    await properties.getByRole('tab', { name: 'Validation', exact: true }).click()
    const validationSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Rules' })
    await validationSetter.getByRole('switch', { name: 'Enable validation' }).click()
    await validationSetter.getByRole('button', { name: 'Add rule', exact: true }).click()
    await validationSetter.getByRole('combobox', { name: 'Rule 1 type' }).selectOption('email')
    await validationSetter.getByRole('textbox', { name: 'Rule 1 message' }).fill('Enter a valid email')
    await validationSetter.getByRole('textbox', { name: 'Rule 1 message' }).blur()
    await expect(validationSetter.locator('textarea')).toHaveCount(0)

    await properties.getByRole('tab', { name: 'Properties', exact: true }).click()
    const invalidDefaultSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Default value' })
    await invalidDefaultSetter.getByRole('textbox', { name: 'Default value', exact: true }).fill('invalid-email')
    await invalidDefaultSetter.getByRole('textbox', { name: 'Default value', exact: true }).blur()
    await toolbar.getByRole('button', { name: 'Export document', exact: true }).click()
    const invalidExport = example.getByRole('dialog', { name: 'Export document' })
    await expect(invalidExport.getByRole('alert')).toContainText('Enter a valid email')
    await expect(invalidExport.getByRole('button', { name: 'Copy', exact: true })).toBeDisabled()
    await expect(invalidExport.getByRole('button', { name: 'Download', exact: true })).toBeDisabled()
    await invalidExport.getByRole('button', { name: 'Close', exact: true }).click()
    await invalidDefaultSetter.getByRole('textbox', { name: 'Default value', exact: true }).fill('valid@example.com')
    await invalidDefaultSetter.getByRole('textbox', { name: 'Default value', exact: true }).blur()

    await properties.getByRole('tab', { name: 'Conditions', exact: true }).click()
    const requiredSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Required' })
    await requiredSetter.getByRole('button', { name: 'Always', exact: true }).click()
    await expect(requiredSetter.locator('textarea')).toHaveCount(0)
    await expect(linkagePreview).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.locator('.mx-config-form-designer__node.is-selected input')).toHaveAttribute('aria-required', 'true')

    const enabledNode = canvas.locator('[data-node-id="designer-enabled"]')
    await enabledNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    const disabledSetter = properties.locator('.mx-config-form-designer__setter').filter({ hasText: 'Disabled' })
    await disabledSetter.getByRole('button', { name: 'Always', exact: true }).click()
    await expect(enabledNode.locator('.el-switch__input')).toBeDisabled()
    await enabledNode.getByRole('button', { name: 'Move node up', exact: true }).click()
    await enabledNode.getByRole('button', { name: 'Move node into previous container', exact: true }).click()
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
    const exportedCard = exportedDocument.nodes.find((node: { id?: string }) => node.id === 'designer-card')
    const exportedChoice = exportedCard.slots.default.find((node: { id?: string }) => node.id === 'designer-choice')
    const exportedEnabled = exportedCard.slots.default.find((node: { id?: string }) => node.id === 'designer-enabled')
    expect(exportedDocument.version).toBe(1)
    expect(exportedDocument.form.labelPosition).toBe('left')
    expect(exportedDocument.form.responsive).toEqual({
      tablet: { columns: 12, fieldSpan: 12 },
      mobile: { columns: 1, fieldSpan: 1 },
    })
    expect(exportedEnabled.defaultValue).toBe(true)
    expect(exportedEnabled).not.toHaveProperty('span')
    expect(exportedEnabled.conditions).toMatchObject({
      disabled: { kind: 'literal', value: true },
    })
    expect(exportedChoice.props.optionSource).toEqual({ kind: 'dictionary', key: 'environments' })
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
    await expect(previewDialog).toContainText('Environment')
    const exportedPreviewSignature = await readDesignerPreviewSignature(previewDialog)
    expect(exportedPreviewSignature).toMatchObject({
      cards: 1,
      sections: 1,
      fields: expect.arrayContaining([
        expect.objectContaining({ field: 'input', label: 'Email', required: true }),
        expect.objectContaining({ field: 'environment', label: 'Environment' }),
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
    await expect(importedPreview).toContainText('Environment')
    expect(await readDesignerPreviewSignature(importedPreview)).toEqual(exportedPreviewSignature)
  })
})

test('standalone designer entry exposes localized controls on narrow screens', async ({ page }) => {
  await page.goto('/designer.html')
  await expect(page.getByRole('heading', { name: '可视化表单设计器', exact: true })).toBeVisible()
  const framework = page.getByRole('group', { name: '组件库', exact: true })
  await expect(framework.getByRole('button', { name: 'Element Plus', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const designer = page.getByTestId('designer-example')
  await expect(designer.getByRole('toolbar', { name: '设计器操作' })).toBeVisible()
  await expect(designer.getByRole('complementary', { name: '物料', exact: true })).toBeVisible()
  await expect(designer.getByRole('button', { name: '输入框', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Visual Form Designer', exact: true })).toBeVisible()
  await expect(designer.getByRole('toolbar', { name: 'Designer commands', exact: true })).toBeVisible()
  await expect(designer.getByRole('button', { name: 'Input', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '中文', exact: true }).click()
  await expect(designer.getByRole('toolbar', { name: '设计器操作', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 900, height: 900 })
  const workspace = designer.locator('.mx-config-form-designer__workspace')
  const palette = designer.locator('.mx-config-form-designer__palette')
  const properties = designer.locator('.mx-config-form-designer__properties')
  const [workspaceBox, paletteBox, propertiesBox] = await Promise.all([
    workspace.boundingBox(),
    palette.boundingBox(),
    properties.boundingBox(),
  ])
  expect(workspaceBox).not.toBeNull()
  expect(paletteBox).not.toBeNull()
  expect(propertiesBox).not.toBeNull()
  expect(propertiesBox!.y).toBeGreaterThan(paletteBox!.y)
  expect(Math.abs(propertiesBox!.x - workspaceBox!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(propertiesBox!.width - workspaceBox!.width)).toBeLessThanOrEqual(1)

  await page.setViewportSize({ width: 390, height: 844 })
  await framework.getByRole('button', { name: 'Ant Design Vue', exact: true }).click()
  await expect(designer.locator('.mx-config-form-designer')).toHaveAttribute('data-adapter', 'antd-vue')
  const mobileCanvas = designer.locator('.mx-config-form-designer__canvas')
  await expect(mobileCanvas.locator('[data-node-id="designer-name"] .ant-input')).toBeVisible()
  await expect(mobileCanvas.locator('[data-node-id="designer-choice"] .ant-select')).toBeVisible()
  await expect(mobileCanvas.locator('[data-node-id="designer-enabled"] .ant-switch')).toBeVisible()
  await expect(mobileCanvas.locator('.el-input')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expect(designer.getByRole('button', { name: '导出文档', exact: true })).toBeVisible()
  await expect(designer.getByRole('button', { name: '手机', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const [mobileWorkspaceBox, mobilePaletteBox, mobileCanvasBox, mobilePropertiesBox] = await Promise.all([
    workspace.boundingBox(),
    palette.boundingBox(),
    designer.locator('.mx-config-form-designer__canvas').boundingBox(),
    properties.boundingBox(),
  ])
  expect(mobileWorkspaceBox).not.toBeNull()
  expect(mobilePaletteBox).not.toBeNull()
  expect(mobileCanvasBox).not.toBeNull()
  expect(mobilePropertiesBox).not.toBeNull()
  expect(Math.abs(mobileCanvasBox!.x - mobileWorkspaceBox!.x)).toBeLessThanOrEqual(1)
  expect(mobileCanvasBox!.y).toBeGreaterThanOrEqual(mobilePaletteBox!.y + mobilePaletteBox!.height - 1)
  expect(mobilePropertiesBox!.y).toBeGreaterThanOrEqual(mobileCanvasBox!.y + mobileCanvasBox!.height - 1)

  await designer.locator('[data-focus-node-id="designer-name"]').click()
  const nodeActions = designer.locator('[data-node-id="designer-name"] > .mx-config-form-designer__node-actions')
  for (const name of ['上移节点', '下移节点', '移入上一个容器', '移出容器', '复制节点', '删除节点'])
    await expect(nodeActions.getByRole('button', { name, exact: true })).toBeVisible()
})

for (const adapter of [
  {
    framework: 'Element Plus',
    switchSelector: '.el-switch input',
  },
  {
    framework: 'Ant Design Vue',
    switchSelector: '.ant-switch',
  },
] as const) {
  test(`standalone designer visually edits and previews reactions with ${adapter.framework}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/designer.html')

    const framework = page.getByRole('group', { name: '组件库', exact: true })
    if (adapter.framework === 'Ant Design Vue')
      await framework.getByRole('button', { name: adapter.framework, exact: true }).click()

    await page.getByRole('button', { name: 'English', exact: true }).click()
    const designer = page.getByTestId('designer-example')
    const canvas = designer.getByLabel('Form canvas')
    const properties = designer.getByLabel('Properties')
    const toolbar = designer.getByRole('toolbar', { name: 'Designer commands' })
    const enabledNode = canvas.locator('[data-node-id="designer-enabled"]')

    await enabledNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await properties.locator('[data-property-tab="reactions"]').click()

    const reactionEditor = properties.locator('.mx-config-form-designer__reaction-editor')
    await reactionEditor.locator(':scope > .mx-config-form-designer__add-row').click()
    await expect(reactionEditor.locator(':scope > .mx-config-form-designer__reaction-row')).toHaveCount(1)
    await expect(canvas.getByRole('button', { name: 'Linkage preview', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(enabledNode.locator(adapter.switchSelector)).toBeDisabled()

    await toolbar.getByRole('button', { name: 'Export document', exact: true }).click()
    const exportDialog = designer.getByRole('dialog', { name: 'Export document' })
    const exportedDocument = JSON.parse(await exportDialog.locator('textarea').inputValue()) as {
      nodes: Array<Record<string, unknown>>
    }
    const exportedEnabled = exportedDocument.nodes.find(node => node.id === 'designer-enabled')
    expect(exportedEnabled?.reactions).toEqual([{
      id: 'reaction-1',
      when: { kind: 'literal', value: true },
      then: [{
        kind: 'setState',
        state: { disabled: true },
        target: 'enabled',
      }],
    }])
    expect(exportedEnabled).not.toHaveProperty('disabled')
    await exportDialog.getByRole('button', { name: 'Close', exact: true }).click()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(reactionEditor).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
}

test('standalone designer keeps independent Element Plus and Ant Design Vue documents', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/designer.html')
  const designer = page.getByTestId('designer-example')
  const framework = page.getByRole('group', { name: '组件库', exact: true })

  await framework.getByRole('button', { name: 'Ant Design Vue', exact: true }).click()
  await expect(designer.locator('.mx-antd-designer-section')).toBeVisible()
  await expect(designer.locator('[data-node-id="designer-name"] .ant-input')).toBeVisible()
  await expect(designer.locator('[data-node-id="designer-choice"] .ant-select')).toBeVisible()
  await expect(designer.locator('[data-node-id="designer-enabled"] .ant-switch')).toBeVisible()
  await expect.poll(() => designer.locator('.mx-config-form-designer__node-list[data-parent-id=""]').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(24)

  const antCanvas = designer.locator('.mx-config-form-designer__canvas')
  const antFormFields = designer.locator('.mx-config-form-designer__property-fields .mx-config-form-designer-property-form__field.is-simple')
  await antCanvas.click({ position: { x: 5, y: 5 } })
  const antLabelPosition = antFormFields.filter({ hasText: '标签位置' })
  const antReadonly = antFormFields.filter({ hasText: '表单只读' })
  await expect(antFormFields.filter({ hasText: '列数' }).locator('.ant-input-number')).toBeVisible()
  await expect(antFormFields.filter({ hasText: '间距' }).locator('.ant-input')).toBeVisible()
  await expect(antReadonly.locator('.ant-switch')).toBeVisible()
  await expect(antLabelPosition.locator('.ant-segmented')).toBeVisible()
  await antLabelPosition.locator('.ant-segmented-item').filter({ hasText: '顶部' }).click()
  const antNameNode = designer.locator('[data-node-id="designer-name"]')
  await antNameNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
  await expect(antNameNode.locator('.mx-config-form-designer__node-preview.is-label-top')).toBeVisible()
  await expectSingleSelectionFrameMatchesNode(antNameNode)

  const antProperties = designer.locator('.mx-config-form-designer__properties')
  const antLabelInput = antProperties.getByRole('textbox', { name: '标签', exact: true })
  const antToolbar = designer.getByRole('toolbar', { name: '设计器操作', exact: true })
  await antLabelInput.fill('AntD name')
  await expect(antNameNode).toContainText('Name')
  await antLabelInput.blur()
  await expect(antNameNode).toContainText('AntD name')
  await antToolbar.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(antNameNode).toContainText('Name')
  await antToolbar.getByRole('button', { name: '重做', exact: true }).click()
  await expect(antNameNode).toContainText('AntD name')
  await antToolbar.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(antNameNode).toContainText('Name')

  await antCanvas.click({ position: { x: 5, y: 5 } })
  await antLabelPosition.locator('.ant-segmented-item').filter({ hasText: '左侧' }).click()
  await antReadonly.getByRole('switch').click()
  await antNameNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
  await expect(antNameNode.locator('.mx-config-form-designer__node-preview-readonly')).toBeVisible()
  await expectSingleSelectionFrameMatchesNode(antNameNode)

  await antCanvas.click({ position: { x: 5, y: 5 } })
  await antReadonly.getByRole('switch').click()

  for (const field of [
    { nodeId: 'designer-name', selector: '.ant-input' },
    { nodeId: 'designer-choice', selector: '.ant-select' },
    { nodeId: 'designer-enabled', selector: '.ant-switch' },
  ]) {
    const node = designer.locator(`[data-node-id="${field.nodeId}"]`)
    await node.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expectSingleSelectionFrameMatchesNode(node)
  }

  for (const container of [
    { nodeId: 'designer-section', selector: '.mx-antd-designer-section' },
    { nodeId: 'designer-card', selector: '.ant-card' },
  ]) {
    const node = designer.locator(`[data-node-id="${container.nodeId}"]`)
    await node.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expectSingleSelectionFrameMatchesNode(node)
  }

  for (const material of [
    { name: '密码框', selector: '.ant-input-password' },
    { name: '搜索框', selector: '.ant-input-search' },
    { name: '自动完成', selector: '.ant-select-auto-complete' },
    { name: '滑块', selector: '.ant-slider' },
    { name: '评分', selector: '.ant-rate' },
  ]) {
    await designer.getByRole('button', { name: material.name, exact: true }).click()
    const selectedMaterial = designer.locator('.mx-config-form-designer__node.is-selected')
    await expect(selectedMaterial.locator(material.selector)).toBeVisible()
    await selectedMaterial.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expectSingleSelectionFrameMatchesNode(selectedMaterial)
  }

  await designer.getByRole('button', { name: '输入框', exact: true }).click()
  const addedAntInputNode = antCanvas.locator('.mx-config-form-designer__node.is-selected[data-material="antd.input"]')
  await expect(addedAntInputNode).toHaveCount(1)
  await expect(addedAntInputNode.locator('.ant-input')).toBeVisible()
  const addedAntInputId = await addedAntInputNode.getAttribute('data-node-id')
  expect(addedAntInputId).not.toBeNull()

  await framework.getByRole('button', { name: 'Element Plus', exact: true }).click()
  await expect(designer.locator('.mx-element-designer-section')).toBeVisible()
  await expect(antCanvas.locator('.ant-input')).toHaveCount(0)

  await framework.getByRole('button', { name: 'Ant Design Vue', exact: true }).click()
  await expect(antCanvas.locator(`[data-node-id="${addedAntInputId}"] .ant-input`)).toBeVisible()
})

test('keeps root span placement aligned between runtime preview and designer canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/designer.html')
  const designer = page.getByTestId('designer-example')
  const document = {
    version: 1,
    form: { columns: 24, fieldSpan: 8, gap: '16px', labelPosition: 'left' },
    nodes: [
      { id: 'full-switch', kind: 'field', material: 'element.switch', field: 'enabled', label: 'Full width', span: 24 },
      { id: 'left', kind: 'field', material: 'element.input', field: 'left', label: 'Left', span: 8 },
      { id: 'middle', kind: 'field', material: 'element.input', field: 'middle', label: 'Middle', span: 8 },
      { id: 'right', kind: 'field', material: 'element.input', field: 'right', label: 'Right', span: 8 },
      {
        id: 'section',
        kind: 'container',
        material: 'element.section',
        span: 24,
        props: { title: 'Nested content' },
        slots: {
          default: [{
            id: 'nested',
            kind: 'field',
            material: 'element.input',
            field: 'nested',
            label: 'Nested',
            span: 24,
          }],
        },
      },
    ],
  }

  await designer.getByRole('button', { name: '导入文档', exact: true }).click()
  const importDialog = designer.getByRole('dialog', { name: '导入文档', exact: true })
  await importDialog.locator('textarea').fill(JSON.stringify(document))
  await importDialog.getByRole('button', { name: '应用', exact: true }).click()

  await designer.getByRole('button', { name: '预览表单', exact: true }).click()
  const preview = designer.getByRole('dialog', { name: '表单预览', exact: true })
  const runtimeRow = preview.locator('[data-config-form-responsive-layout]').first()
  const runtimeCells = runtimeRow.locator(':scope > [data-config-form-responsive-cell]')
  await expect(runtimeCells).toHaveCount(5)
  const runtimePlacement = await runtimeCells.evaluateAll(elements => elements.slice(0, 4).map(element => ({
    column: getComputedStyle(element).gridColumn,
    top: Math.round(element.getBoundingClientRect().top),
    width: element.getBoundingClientRect().width,
  })))
  expect(runtimePlacement.map(item => item.column)).toEqual([
    'span 24 / span 24',
    'span 8 / span 8',
    'span 8 / span 8',
    'span 8 / span 8',
  ])
  expect(runtimePlacement[0]!.top).toBeLessThan(runtimePlacement[1]!.top)
  expect(new Set(runtimePlacement.slice(1).map(item => item.top))).toHaveProperty('size', 1)
  const runtimeRowWidth = await runtimeRow.evaluate(element => element.getBoundingClientRect().width)
  expect(runtimePlacement[0]!.width).toBeCloseTo(runtimeRowWidth, 0)
  expect(runtimePlacement[0]!.width).toBeGreaterThan(runtimePlacement[1]!.width * 2.8)
  await preview.getByRole('button', { name: '关闭预览', exact: true }).click()

  const designerCells = designer.locator('.mx-config-form-designer__node-list[data-parent-id=""]').first().locator(':scope > .mx-config-form-designer__node')
  await expect(designerCells).toHaveCount(5)
  const designerPlacement = await designerCells.evaluateAll(elements => elements.slice(0, 4).map(element => ({
    column: getComputedStyle(element).gridColumn,
    top: Math.round(element.getBoundingClientRect().top),
    width: element.getBoundingClientRect().width,
  })))
  expect(designerPlacement.map(item => item.column)).toEqual(runtimePlacement.map(item => item.column))
  expect(designerPlacement[0]!.top).toBeLessThan(designerPlacement[1]!.top)
  expect(new Set(designerPlacement.slice(1).map(item => item.top))).toHaveProperty('size', 1)
  expect(designerPlacement[0]!.width).toBeGreaterThan(designerPlacement[1]!.width * 2.8)

  const properties = designer.locator('.mx-config-form-designer__properties')
  const fullSwitchNode = designer.locator('[data-node-id="full-switch"]')
  await fullSwitchNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
  await expect(fullSwitchNode).toHaveClass(/mx-element-config-form__cell/)
  await expect(fullSwitchNode.locator('.mx-element-config-form__field')).toHaveCount(1)
  await expectSingleSelectionFrameMatchesNode(fullSwitchNode)
  const fullSwitchGeometry = await fullSwitchNode.evaluate((element) => {
    const cell = element.getBoundingClientRect()
    const control = element.querySelector<HTMLElement>('.el-switch')!.getBoundingClientRect()
    const frame = getComputedStyle(element, '::after')
    return {
      cellWidth: cell.width,
      controlWidth: control.width,
      frameBorder: frame.borderStyle,
      frameInsets: [frame.top, frame.right, frame.bottom, frame.left],
      oldFrameCount: element.querySelectorAll(':scope > .mx-config-form-designer__selection-overlay, :scope > [data-designer-span-footprint]').length,
    }
  })
  expect(fullSwitchGeometry.frameBorder).toBe('dashed')
  expect(fullSwitchGeometry.frameInsets).toEqual(['-5px', '-5px', '-5px', '-5px'])
  expect(fullSwitchGeometry.oldFrameCount).toBe(0)
  expect(fullSwitchGeometry.controlWidth).toBeLessThan(fullSwitchGeometry.cellWidth / 2)
  await expect(properties.getByRole('spinbutton', { name: '栅格宽度', exact: true })).toHaveCount(1)
  await designer.locator('[data-node-id="nested"] > .mx-config-form-designer__node-preview-shell').click()
  await expect(properties.getByRole('spinbutton', { name: '栅格宽度', exact: true })).toHaveCount(0)
})

for (const adapter of [
  {
    cardBodySelector: '.el-card__body',
    cardHeaderSelector: '.el-card__header',
    cardMaterial: 'element.card',
    cardSelector: '.el-card',
    collapseHeaderSelector: '.el-collapse-item__header',
    collapseItemMaterial: 'element.collapse-item',
    collapseMaterial: 'element.collapse',
    collapseSelector: '.el-collapse',
    flexSelector: '.mx-element-flex-layout',
    flexMaterial: 'element.flex',
    framework: 'Element Plus',
    gridSelector: '.mx-element-grid-layout',
    gridMaterial: 'element.grid',
    namespace: 'mx-element-config-form',
    sectionMaterial: 'element.section',
    sectionSelector: '.mx-element-designer-section',
    tabHeaderSelector: '.el-tabs__item',
    tabPaneMaterial: 'element.tab-pane',
    tabsMaterial: 'element.tabs',
    tabsSelector: '.el-tabs',
  },
  {
    cardBodySelector: '.ant-card-body',
    cardHeaderSelector: '.ant-card-head',
    cardMaterial: 'antd.card',
    cardSelector: '.ant-card',
    collapseHeaderSelector: '.ant-collapse-header',
    collapseItemMaterial: 'antd.collapse-item',
    collapseMaterial: 'antd.collapse',
    collapseSelector: '.ant-collapse',
    flexSelector: '.mx-antd-flex-layout',
    flexMaterial: 'antd.flex',
    framework: 'Ant Design Vue',
    gridSelector: '.mx-antd-grid-layout',
    gridMaterial: 'antd.grid',
    namespace: 'mx-antd-config-form',
    sectionMaterial: 'antd.section',
    sectionSelector: '.mx-antd-designer-section',
    tabHeaderSelector: '.ant-tabs-tab',
    tabPaneMaterial: 'antd.tab-pane',
    tabsMaterial: 'antd.tabs',
    tabsSelector: '.ant-tabs',
  },
] as const) {
  test(`standalone designer renders real flex/grid materials and form readonly preview with ${adapter.framework}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/designer.html')
    const designer = page.getByTestId('designer-example')
    const designerCanvas = designer.locator('.mx-config-form-designer__canvas')

    if (adapter.framework === 'Ant Design Vue')
      await page.getByRole('group', { name: '组件库', exact: true }).getByRole('button', { name: adapter.framework, exact: true }).click()

    const initialRootCells = designer.locator('.mx-config-form-designer__node-list[data-parent-id=""]').first().locator(':scope > .mx-config-form-designer__node')
    await expect.poll(async () => initialRootCells.count()).toBeGreaterThan(0)
    expect(await initialRootCells.evaluateAll((elements, namespace) => elements.every(element => element.classList.contains(`${namespace}__cell`)), adapter.namespace)).toBe(true)
    const initialFields = designer.locator(`.${adapter.namespace}__field`)
    await expect.poll(async () => initialFields.count()).toBeGreaterThan(0)
    expect(await initialFields.evaluateAll((elements, namespace) => elements.every(element => (
      Boolean(element.querySelector(`.${namespace}__control`))
      && (!element.textContent?.trim() || Boolean(element.querySelector(`.${namespace}__label`)) || !element.classList.contains('has-label'))
    )), adapter.namespace)).toBe(true)

    const sectionNode = designer.locator(`[data-material="${adapter.sectionMaterial}"]`).first()
    const sectionMetrics = await sectionNode.locator(adapter.sectionSelector).evaluate((element) => {
      const header = element.querySelector<HTMLElement>(':scope > header')!
      const list = element.querySelector<HTMLElement>(':scope > .mx-config-form-designer__node-list')!
      return {
        borderStyle: getComputedStyle(element).borderTopStyle,
        headerBorderStyle: getComputedStyle(header).borderBottomStyle,
        listBorderStyle: getComputedStyle(list).borderTopStyle,
        listPadding: getComputedStyle(list).paddingTop,
      }
    })
    expect(sectionMetrics).toEqual({
      borderStyle: 'none',
      headerBorderStyle: 'solid',
      listBorderStyle: 'none',
      listPadding: '0px',
    })
    const sectionList = sectionNode.locator(`${adapter.sectionSelector} > .mx-config-form-designer__node-list`)
    await expectNativeNestedFlow(sectionList)
    const initialCardNode = designer.locator('[data-node-id="designer-card"]')
    await expect(initialCardNode.locator(adapter.cardSelector)).toBeVisible()
    await expect(initialCardNode.locator(adapter.cardHeaderSelector)).toBeVisible()
    await expect(initialCardNode.locator(adapter.cardBodySelector)).toBeVisible()
    const cardList = designer.locator('[data-node-id="designer-card"] .mx-config-form-designer__node-list[data-parent-id="designer-card"]')
    await expectNativeNestedFlow(cardList)

    await designerCanvas.click({ position: { x: 5, y: 5 } })
    await designer.getByRole('button', { name: '分区', exact: true }).click()
    const emptySectionNode = designer.locator(`[data-material="${adapter.sectionMaterial}"]`).last()
    const emptySectionList = emptySectionNode.locator(`${adapter.sectionSelector} > .mx-config-form-designer__node-list`)
    await expectNativeNestedFlow(emptySectionList)
    await expectQuietEmptySlot(emptySectionList)

    await designerCanvas.click({ position: { x: 5, y: 5 } })
    await designer.getByRole('button', { name: '卡片', exact: true }).click()
    const emptyCardNode = designer.locator(`[data-material="${adapter.cardMaterial}"]`).last()
    await expect(emptyCardNode.locator(adapter.cardSelector)).toBeVisible()
    await expect(emptyCardNode.locator(adapter.cardHeaderSelector)).toBeVisible()
    const emptyCardList = emptyCardNode.locator(`${adapter.cardBodySelector} > .mx-config-form-designer__node-list`)
    await expectNativeNestedFlow(emptyCardList)
    await expectQuietEmptySlot(emptyCardList)

    const environmentNode = designer.locator('[data-node-id="designer-choice"]')
    await expect(environmentNode).toContainText('Playground')
    await environmentNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    const environmentDefault = designer.locator('.mx-config-form-designer__properties .mx-config-form-designer__setter').filter({ hasText: '默认值' })
    await environmentDefault.getByRole('button', { name: 'Production', exact: true }).click()
    await expect(environmentNode).toContainText('Production')

    await designerCanvas.click({ position: { x: 5, y: 5 } })
    await designer.getByRole('button', { name: '标签页', exact: true }).click()
    const tabsNode = designer.locator(`[data-material="${adapter.tabsMaterial}"]`).last()
    await expect(tabsNode.locator(adapter.tabsSelector)).toBeVisible()
    await expect(tabsNode.locator(adapter.tabHeaderSelector)).toContainText('Tab 1')
    const tabPaneNode = tabsNode.locator(`[data-material="${adapter.tabPaneMaterial}"]`)
    await expect(tabPaneNode).toHaveCount(1)
    const tabPaneList = tabPaneNode.locator(`.mx-config-form-designer__node-list.is-empty[data-parent-material="${adapter.tabPaneMaterial}"]`)
    await expectNativeNestedFlow(tabPaneList)
    await expectQuietEmptySlot(tabPaneList)
    if (adapter.framework === 'Ant Design Vue')
      await tabsNode.locator('.mx-antd-designer-structural-label').first().click()
    else
      await tabPaneNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expect(designer.locator('.mx-config-form-designer__node.is-selected:focus-within')).toHaveCount(1)
    await expectSingleSelectionFrameMatchesNode(tabPaneNode)

    await designerCanvas.click({ position: { x: 5, y: 5 } })
    await designer.getByRole('button', { name: '折叠面板', exact: true }).click()
    const collapseNode = designer.locator(`[data-material="${adapter.collapseMaterial}"]`).last()
    await expect(collapseNode.locator(adapter.collapseSelector)).toBeVisible()
    await expect(collapseNode.locator(adapter.collapseHeaderSelector)).toContainText('Item 1')
    const collapseItemNode = collapseNode.locator(`[data-material="${adapter.collapseItemMaterial}"]`)
    await expect(collapseItemNode).toHaveCount(1)
    const collapseItemList = collapseItemNode.locator(`.mx-config-form-designer__node-list.is-empty[data-parent-material="${adapter.collapseItemMaterial}"]`)
    await expectNativeNestedFlow(collapseItemList)
    await expectQuietEmptySlot(collapseItemList)
    if (adapter.framework === 'Ant Design Vue')
      await collapseNode.locator('.mx-antd-designer-structural-label').last().click()
    else
      await collapseItemNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expect(designer.locator('.mx-config-form-designer__node.is-selected:focus-within')).toHaveCount(1)
    await expectSingleSelectionFrameMatchesNode(collapseItemNode)

    await designerCanvas.click({ position: { x: 5, y: 5 } })
    await designer.getByRole('button', { name: 'Flex 换行', exact: true }).click()
    const flexNode = designer.locator(`[data-material="${adapter.flexMaterial}"]`).last()
    await expect(flexNode.locator(adapter.flexSelector)).toBeVisible()
    const flexList = flexNode.locator(`${adapter.flexSelector} > .mx-config-form-designer__node-list`)
    await expect(flexList).toHaveAttribute('data-parent-material', adapter.flexMaterial)
    await expectNativeNestedFlow(flexList)
    const flexEmptySlot = await expectQuietEmptySlot(flexList)
    const quietFlexSurface = await flexEmptySlot.evaluate((element) => {
      const styles = getComputedStyle(element)
      return { backgroundColor: styles.backgroundColor, borderColor: styles.borderTopColor }
    })
    expect(await flexList.evaluate((element) => {
      const empty = element.querySelector<HTMLElement>(':scope > .mx-config-form-designer__empty-slot')!
      return {
        backgroundImage: getComputedStyle(empty).backgroundImage,
        borderStyle: getComputedStyle(element).borderTopStyle,
        emptyBorderStyle: getComputedStyle(empty).borderTopStyle,
        emptyFlexBasis: getComputedStyle(empty).flexBasis,
        padding: getComputedStyle(element).paddingTop,
      }
    })).toMatchObject({
      borderStyle: 'none',
      emptyBorderStyle: 'solid',
      emptyFlexBasis: '100%',
      padding: '0px',
    })
    expect(await flexList.locator(':scope > .mx-config-form-designer__empty-slot').evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe('none')
    const flexProperties = designer.locator('.mx-config-form-designer__properties')
    await expect(flexProperties).toContainText('换行')
    const wrapField = flexProperties.locator('.mx-config-form-designer-property-form__field.is-simple').filter({ hasText: '换行' })
    const wrapSwitch = wrapField.locator(adapter.framework === 'Ant Design Vue' ? '.ant-switch' : '.el-switch')
    await expect(wrapSwitch).toBeVisible()
    await wrapSwitch.click()
    await expect.poll(() => flexList.evaluate(element => getComputedStyle(element).flexWrap)).toBe('nowrap')
    await wrapSwitch.click()
    await expect.poll(() => flexList.evaluate(element => getComputedStyle(element).flexWrap)).toBe('wrap')
    await inspectSortableDrag(
      page,
      designer.getByRole('button', { name: '输入框', exact: true }),
      async () => {
        await expect(designer.locator('.mx-config-form-designer')).toHaveClass(/is-dragging/)
        const draggingSurface = await flexEmptySlot.evaluate((element) => {
          const styles = getComputedStyle(element)
          return {
            backgroundColor: styles.backgroundColor,
            borderColor: styles.borderTopColor,
            borderStyle: styles.borderTopStyle,
          }
        })
        expect(draggingSurface.borderStyle).toBe('dashed')
        expect(draggingSurface.backgroundColor).not.toBe(quietFlexSurface.backgroundColor)
        expect(draggingSurface.borderColor).not.toBe(quietFlexSurface.borderColor)
      },
    )
    await expect(designer.locator('.mx-config-form-designer')).not.toHaveClass(/is-dragging/)
    await flexNode.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await designer.getByRole('button', { name: '输入框', exact: true }).click()
    const flexField = flexNode.locator(`${adapter.flexSelector} [data-node-kind="field"]`)
    await expect(flexField).toHaveCount(1)
    await expect(flexList.locator(':scope > .mx-config-form-designer__empty-slot')).toHaveCount(0)
    await flexField.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expect(designer.locator('.mx-config-form-designer__node.is-selected:focus-within')).toHaveCount(1)
    await expectSingleSelectionFrameMatchesNode(flexField)

    await designerCanvas.click({ position: { x: 5, y: 5 } })
    await designer.getByRole('button', { name: 'Grid 栅格', exact: true }).click()
    const gridNode = designer.locator(`[data-material="${adapter.gridMaterial}"]`).last()
    await expect(gridNode.locator(adapter.gridSelector)).toBeVisible()
    const gridList = gridNode.locator(`${adapter.gridSelector} > .mx-config-form-designer__node-list`)
    await expect(gridList).toHaveAttribute('data-parent-material', adapter.gridMaterial)
    await expectNativeNestedFlow(gridList)
    const gridEmptySlot = await expectQuietEmptySlot(gridList)
    expect(await gridList.evaluate((element) => {
      const empty = element.querySelector<HTMLElement>(':scope > .mx-config-form-designer__empty-slot')!
      return {
        backgroundImage: getComputedStyle(empty).backgroundImage,
        borderStyle: getComputedStyle(element).borderTopStyle,
        emptyBorderStyle: getComputedStyle(empty).borderTopStyle,
        emptyGridColumn: getComputedStyle(empty).gridColumn,
        padding: getComputedStyle(element).paddingTop,
      }
    })).toMatchObject({
      borderStyle: 'none',
      emptyBorderStyle: 'solid',
      emptyGridColumn: '1 / -1',
      padding: '0px',
    })
    expect(await gridList.locator(':scope > .mx-config-form-designer__empty-slot').evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe('none')
    await inspectSortableDrag(
      page,
      designer.getByRole('button', { name: '输入框', exact: true }),
      async () => {
        await expect(designer.locator('.mx-config-form-designer')).toHaveClass(/is-dragging/)
        expect(await gridEmptySlot.evaluate((element) => {
          const styles = getComputedStyle(element)
          return {
            backgroundImage: styles.backgroundImage,
            borderStyle: styles.borderTopStyle,
          }
        })).toMatchObject({ borderStyle: 'dashed' })
      },
    )
    await expect(designer.locator('.mx-config-form-designer')).not.toHaveClass(/is-dragging/)
    await designer.getByRole('button', { name: '输入框', exact: true }).click()
    const gridField = gridNode.locator(`${adapter.gridSelector} [data-node-kind="field"]`)
    await expect(gridField).toHaveCount(1)
    await expect(gridList.locator(':scope > .mx-config-form-designer__empty-slot')).toHaveCount(0)
    await gridField.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expect(designer.locator('.mx-config-form-designer__node.is-selected:focus-within')).toHaveCount(1)
    await expectSingleSelectionFrameMatchesNode(gridField)
    await expect(designer.locator('.mx-config-form-designer__properties')).not.toContainText('表单只读')

    await designerCanvas.click({ position: { x: 5, y: 5 } })
    const formProperties = designer.locator('.mx-config-form-designer__properties')
    const formReadonlyField = formProperties.locator('.mx-config-form-designer-property-form__field.is-simple').filter({ hasText: '表单只读' })
    const formReadonlyControl = formReadonlyField.locator(adapter.framework === 'Ant Design Vue' ? '.ant-switch' : '.el-switch')
    await expect(formReadonlyControl).toBeVisible()
    await formReadonlyControl.click()

    await designer.getByRole('button', { name: '预览表单', exact: true }).click()
    const preview = designer.getByRole('dialog', { name: '表单预览', exact: true })
    await expect(preview.locator(`.${adapter.namespace}__readonly`)).toHaveCount(5)
    await expect(preview).toContainText('Production')
    await expect(preview.locator(`${adapter.flexSelector} > .${adapter.namespace}__field`)).toHaveCount(1)
    await expect(preview.locator(`${adapter.gridSelector} > .${adapter.namespace}__field`)).toHaveCount(1)
    await expect.poll(() => preview.locator(`${adapter.flexSelector} > .${adapter.namespace}__field`).evaluate(element => getComputedStyle(element).flexBasis)).toBe('220px')
    await expect(preview.locator('input')).toHaveCount(0)

    const designerRow = designer.locator('.mx-config-form-designer__node-list[data-parent-id=""]').first()
    const runtimeRow = preview.locator(`.${adapter.namespace}__row`).first()
    const columnCount = (locator: typeof designerRow) => locator.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)

    await expect.poll(() => columnCount(designerRow)).toBe(24)
    await expect.poll(() => columnCount(runtimeRow)).toBe(24)

    await page.setViewportSize({ width: 900, height: 900 })
    await expect.poll(() => columnCount(designerRow)).toBe(12)
    await expect.poll(() => columnCount(runtimeRow)).toBe(12)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => columnCount(designerRow)).toBe(1)
    await expect.poll(() => columnCount(runtimeRow)).toBe(1)
    await preview.locator('header button').click()
    await expect(preview).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)

    const canvasSheet = designer.locator('.mx-config-form-designer__canvas-sheet')
    for (const containerNode of [emptySectionNode, emptyCardNode, tabsNode, collapseNode, flexNode, gridNode]) {
      await containerNode.scrollIntoViewIfNeeded()
      const [containerBox, canvasBox] = await Promise.all([containerNode.boundingBox(), canvasSheet.boundingBox()])
      expect(containerBox).not.toBeNull()
      expect(canvasBox).not.toBeNull()
      expect(containerBox!.width).toBeLessThanOrEqual(canvasBox!.width + 1)
    }
    await expectQuietEmptySlot(emptySectionList)
    await expectQuietEmptySlot(emptyCardList)
    await expectQuietEmptySlot(tabPaneList)
    await expectQuietEmptySlot(collapseItemList)
    await expect(tabsNode.locator(adapter.tabHeaderSelector)).toBeVisible()
    await expect(collapseItemList).toBeVisible()

    await flexField.scrollIntoViewIfNeeded()
    await flexField.locator(':scope > .mx-config-form-designer__node-preview-shell').click()
    await expect(designer.locator('.mx-config-form-designer__node.is-selected:focus-within')).toHaveCount(1)
    await expectSingleSelectionFrameMatchesNode(flexField)
    const mobileActions = await flexField.locator(':scope > .mx-config-form-designer__node-actions').boundingBox()
    expect(mobileActions).not.toBeNull()
    expect(mobileActions!.x).toBeGreaterThanOrEqual(0)
    expect(mobileActions!.x + mobileActions!.width).toBeLessThanOrEqual(391)
  })
}
