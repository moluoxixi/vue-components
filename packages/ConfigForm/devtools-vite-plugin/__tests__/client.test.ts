// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installConfigFormDevtools } from '../src/client'

describe('client overlay', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 0 })
    delete (window as typeof window & { __CONFIG_FORM_DEVTOOLS_BRIDGE__?: unknown }).__CONFIG_FORM_DEVTOOLS_BRIDGE__
    delete (window as typeof window & { __CONFIG_FORM_DEVTOOLS_PENDING__?: unknown }).__CONFIG_FORM_DEVTOOLS_PENDING__
    vi.restoreAllMocks()
  })

  it('mounts a bubble, renders field nodes, highlights elements, and opens source locations', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    const target = document.createElement('div')
    target.getBoundingClientRect = () => ({
      bottom: 40,
      height: 30,
      left: 10,
      right: 110,
      top: 10,
      width: 100,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    })
    document.body.append(target)

    expect(document.head.textContent).toContain('translateX(20px)')

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'username',
      formId: 'form-1',
      id: 'node-1',
      label: '用户名',
      source: {
        column: 5,
        file: 'D:/project-new/ConfigForm/playgrounds/element-plus-playground/src/demos/GridForm.vue',
        id: 'source-1',
        line: 32,
      },
    }, target)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.recordRender({
      duration: 12.34,
      id: 'node-1',
      phase: 'mount',
      timestamp: 1,
    })
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.recordRender({
      duration: 13.45,
      id: 'node-1',
      phase: 'update',
      timestamp: 2,
    })
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.recordSync({
      duration: 2.5,
      id: 'node-1',
      timestamp: 3,
    })
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'username-option',
      formId: 'form-1',
      id: 'node-2',
      parentId: 'node-1',
      slotName: 'default',
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect(document.body.textContent).toContain('username')
    expect(document.body.textContent).toContain('slot:default')
    expect(document.body.textContent).toContain('用户名')
    expect(document.body.textContent).toContain('render 13.45 ms')
    expect(document.body.textContent).toContain('sync 2.50 ms')

    document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-1"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    const highlight = document.querySelector<HTMLElement>('[data-cf-devtools="highlight"]')
    expect(highlight?.style.display).toBe('block')
    expect(highlight?.style.left).toBe('10px')

    document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-1"]')?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    expect(highlight?.style.display).toBe('none')

    document.querySelector<HTMLButtonElement>('[data-cf-devtools-open="node-1"]')?.click()
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/__config-form-devtools/open', expect.objectContaining({
        method: 'POST',
      }))
    })
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"line":32')
  })

  it('renders field and component node text badges beside display names', () => {
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'gender',
      formId: 'form-1',
      id: 'field-gender',
      label: '性别',
      order: 1,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'component',
      component: 'ElRadio',
      formId: 'form-1',
      id: 'component-radio',
      order: 2,
      parentId: 'field-gender',
      slotName: 'default',
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    const fieldRow = document.querySelector<HTMLElement>('[data-cf-devtools-node-id="field-gender"]')
    const componentRow = document.querySelector<HTMLElement>('[data-cf-devtools-node-id="component-radio"]')

    expect(fieldRow?.querySelector('.cf-devtools-node-kind')?.textContent).toBe('F')
    expect(fieldRow?.querySelector('.cf-devtools-node-key')?.textContent).toBe('gender')
    expect(componentRow?.querySelector('.cf-devtools-node-kind')?.textContent).toBe('C')
    expect(componentRow?.querySelector('.cf-devtools-node-key')?.textContent).toBe('ElRadio')
    expect(componentRow?.textContent).toContain('slot:default')
  })

  it('keeps render and sync metrics that arrive before node registration', () => {
    const bridge = installConfigFormDevtools()

    bridge.recordRender({
      duration: 4.56,
      id: 'pending-node',
      phase: 'mount',
      timestamp: 1,
    })
    bridge.recordSync({
      duration: 1.25,
      id: 'pending-node',
      timestamp: 2,
    })
    bridge.registerField({
      field: 'pending',
      formId: 'form-1',
      id: 'pending-node',
      kind: 'field',
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect(document.body.textContent).toContain('render 4.56 ms')
    expect(document.body.textContent).toContain('sync 1.25 ms')
  })

  it('closes the panel when clicking outside the debugger overlay', () => {
    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')

    if (!bubble || !panel)
      throw new Error('Expected devtools bubble and panel to exist')

    bubble.click()
    expect(panel.classList.contains('is-open')).toBe(true)

    panel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(panel.classList.contains('is-open')).toBe(true)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(panel.classList.contains('is-open')).toBe(false)
  })

  it('highlights picker candidates on hover and opens source by clicking the page element', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    const target = document.createElement('button')
    target.getBoundingClientRect = () => ({
      bottom: 44,
      height: 24,
      left: 20,
      right: 160,
      top: 20,
      width: 140,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    })
    document.body.append(target)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'email',
      formId: 'form-1',
      id: 'node-email',
      kind: 'field',
      order: 1,
      source: {
        column: 5,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-email',
        line: 32,
      },
    }, target)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    const pickButton = document.querySelector<HTMLButtonElement>('[data-cf-devtools-pick]')
    pickButton?.click()
    expect(pickButton?.getAttribute('aria-pressed')).toBe('true')

    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }))
    const highlight = document.querySelector<HTMLElement>('[data-cf-devtools="highlight"]')
    expect(highlight?.style.display).toBe('block')
    expect(highlight?.style.left).toBe('20px')
    expect(fetchMock).not.toHaveBeenCalled()

    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(pickButton?.getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')?.classList.contains('is-open')).toBe(true)
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-email"]')?.classList.contains('is-selected')).toBe(true)
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/__config-form-devtools/open', expect.objectContaining({
        method: 'POST',
      }))
    })
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"line":32')
    expect(document.body.textContent).not.toContain('Opened source:')
  })

  it('selects the innermost component or field when picker candidates are nested', () => {
    installConfigFormDevtools()

    const parent = document.createElement('section')
    parent.getBoundingClientRect = () => ({
      bottom: 140,
      height: 120,
      left: 20,
      right: 260,
      top: 20,
      width: 240,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    })
    const child = document.createElement('input')
    child.getBoundingClientRect = () => ({
      bottom: 66,
      height: 26,
      left: 40,
      right: 220,
      top: 40,
      width: 180,
      x: 40,
      y: 40,
      toJSON: () => ({}),
    })
    parent.append(child)
    document.body.append(parent)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      component: 'CardContainer',
      formId: 'form-1',
      id: 'node-container',
      kind: 'component',
      order: 1,
    }, parent)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'name',
      formId: 'form-1',
      id: 'node-name',
      kind: 'field',
      order: 1,
      parentId: 'node-container',
    }, child)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    document.querySelector<HTMLButtonElement>('[data-cf-devtools-pick]')?.click()
    child.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-name"]')?.classList.contains('is-selected')).toBe(true)
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-container"]')?.classList.contains('is-selected')).toBe(false)
  })

  it('cancels picker mode with Escape', () => {
    installConfigFormDevtools()

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    const pickButton = document.querySelector<HTMLButtonElement>('[data-cf-devtools-pick]')
    pickButton?.click()
    expect(pickButton?.getAttribute('aria-pressed')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))

    expect(pickButton?.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders explicit field order even when nodes register out of render order', () => {
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first-child-b',
      formId: 'form-1',
      id: 'first-child-b',
      kind: 'field',
      order: 3,
      parentId: 'first-root',
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second-root',
      formId: 'form-1',
      id: 'second-root',
      kind: 'field',
      order: 4,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first-child-a',
      formId: 'form-1',
      id: 'first-child-a',
      kind: 'field',
      order: 2,
      parentId: 'first-root',
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first-root',
      formId: 'form-1',
      id: 'first-root',
      kind: 'field',
      order: 1,
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['first-root', 'first-child-a', 'first-child-b', 'second-root'])
  })

  it('renders multiple ConfigForms as a navlist and shows only the selected form tree', () => {
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first-form-first',
      formId: 'form-1',
      id: 'form-1:first',
      kind: 'field',
      order: 1,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second-form-first',
      formId: 'form-2',
      id: 'form-2:first',
      kind: 'field',
      order: 1,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first-form-second',
      formId: 'form-1',
      id: 'form-1:second',
      kind: 'field',
      order: 2,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second-form-second',
      formId: 'form-2',
      id: 'form-2:second',
      kind: 'field',
      order: 2,
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-nav-form-id]')]
      .map(node => node.dataset.cfDevtoolsNavFormId))
      .toEqual(['form-1', 'form-2'])
    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['form-1:first', 'form-1:second'])

    document.querySelector<HTMLButtonElement>('[data-cf-devtools-nav-form-id="form-2"]')?.click()

    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-2"]')?.classList.contains('is-active')).toBe(true)
    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['form-2:first', 'form-2:second'])
  })

  it('uses form labels in the ConfigForm navlist when available', () => {
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-1',
      formLabel: 'element Grid 模式',
      id: 'form-1:grid',
      kind: 'field',
      order: 1,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'nested',
      formId: 'form-2',
      formLabel: 'element Card 嵌套 Checkbox',
      id: 'form-2:nested',
      kind: 'field',
      order: 1,
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('.cf-devtools-nav-title')]
      .map(node => node.textContent))
      .toEqual(['element Grid 模式', 'element Card 嵌套 Checkbox'])
  })

  it('renders ConfigForm navlist by DOM order instead of registration order', () => {
    installConfigFormDevtools()

    const gridElement = document.createElement('div')
    const inlineElement = document.createElement('div')
    document.body.append(gridElement, inlineElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'inline',
      formId: 'form-inline',
      formLabel: 'element Inline 模式',
      id: 'form-inline:first',
      kind: 'field',
      order: 1,
    }, inlineElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-grid',
      formLabel: 'element Grid 模式',
      id: 'form-grid:first',
      kind: 'field',
      order: 1,
    }, gridElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('.cf-devtools-nav-title')]
      .map(node => node.textContent))
      .toEqual(['element Grid 模式', 'element Inline 模式'])
  })

  it('keeps ConfigForm navlist in DOM order when registration already follows DOM order', () => {
    installConfigFormDevtools()

    const gridElement = document.createElement('div')
    const inlineElement = document.createElement('div')
    document.body.append(gridElement, inlineElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-grid',
      formLabel: 'element Grid 模式',
      id: 'form-grid:first',
      kind: 'field',
      order: 1,
    }, gridElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'inline',
      formId: 'form-inline',
      formLabel: 'element Inline 模式',
      id: 'form-inline:first',
      kind: 'field',
      order: 1,
    }, inlineElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('.cf-devtools-nav-title')]
      .map(node => node.textContent))
      .toEqual(['element Grid 模式', 'element Inline 模式'])
  })

  it('uses descendant node elements for DOM ordering when a root node has no element', () => {
    installConfigFormDevtools()

    const inlineChildElement = document.createElement('div')
    const gridElement = document.createElement('div')
    document.body.append(inlineChildElement, gridElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      component: 'InlineRoot',
      formId: 'form-inline',
      formLabel: 'element Inline 模式',
      id: 'form-inline:root',
      kind: 'component',
      order: 1,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'inline',
      formId: 'form-inline',
      id: 'form-inline:child',
      kind: 'field',
      order: 1,
      parentId: 'form-inline:root',
    }, inlineChildElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-grid',
      formLabel: 'element Grid 模式',
      id: 'form-grid:first',
      kind: 'field',
      order: 1,
    }, gridElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('.cf-devtools-nav-title')]
      .map(node => node.textContent))
      .toEqual(['element Inline 模式', 'element Grid 模式'])
  })

  it('falls back to registration order when DOM position cannot be compared', () => {
    installConfigFormDevtools()

    const firstElement = document.createElement('div')
    const secondElement = document.createElement('div')
    firstElement.compareDocumentPosition = () => 0
    secondElement.compareDocumentPosition = () => 0
    document.body.append(firstElement, secondElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first',
      formId: 'form-first',
      formLabel: 'First form',
      id: 'form-first:first',
      kind: 'field',
      order: 1,
    }, firstElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second',
      formId: 'form-second',
      formLabel: 'Second form',
      id: 'form-second:first',
      kind: 'field',
      order: 1,
    }, secondElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('.cf-devtools-nav-title')]
      .map(node => node.textContent))
      .toEqual(['First form', 'Second form'])
  })

  it('selects the first visible ConfigForm when multiple forms are registered', () => {
    installConfigFormDevtools()

    const hiddenElement = document.createElement('div')
    hiddenElement.getBoundingClientRect = () => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const visibleElement = document.createElement('div')
    visibleElement.getBoundingClientRect = () => ({
      bottom: 80,
      height: 40,
      left: 20,
      right: 220,
      top: 40,
      width: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    })

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'hidden',
      formId: 'form-1',
      id: 'form-1:hidden',
      kind: 'field',
      order: 1,
    }, hiddenElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'visible',
      formId: 'form-2',
      id: 'form-2:visible',
      kind: 'field',
      order: 1,
    }, visibleElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-2"]')?.classList.contains('is-active')).toBe(true)
    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['form-2:visible'])
  })

  it('selects the ConfigForm with the highest viewport score when multiple forms are visible', () => {
    installConfigFormDevtools()

    const firstElement = document.createElement('div')
    firstElement.getBoundingClientRect = () => ({
      bottom: 100,
      height: 300,
      left: 20,
      right: 220,
      top: -200,
      width: 200,
      x: 20,
      y: -200,
      toJSON: () => ({}),
    })
    const secondElement = document.createElement('div')
    secondElement.getBoundingClientRect = () => ({
      bottom: 420,
      height: 300,
      left: 20,
      right: 220,
      top: 120,
      width: 200,
      x: 20,
      y: 120,
      toJSON: () => ({}),
    })
    document.body.append(firstElement, secondElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first',
      formId: 'form-first',
      formLabel: 'First Form',
      id: 'form-first:first',
      kind: 'field',
      order: 1,
    }, firstElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second',
      formId: 'form-second',
      formLabel: 'Second Form',
      id: 'form-second:first',
      kind: 'field',
      order: 1,
    }, secondElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-second"]')?.classList.contains('is-active')).toBe(true)
    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['form-second:first'])
  })

  it('syncs the active ConfigForm on scroll by viewport score', async () => {
    installConfigFormDevtools()

    let scrolled = false
    const firstElement = document.createElement('div')
    firstElement.getBoundingClientRect = () => scrolled
      ? {
          bottom: -120,
          height: 300,
          left: 20,
          right: 220,
          top: -420,
          width: 200,
          x: 20,
          y: -420,
          toJSON: () => ({}),
        }
      : {
          bottom: 320,
          height: 300,
          left: 20,
          right: 220,
          top: 20,
          width: 200,
          x: 20,
          y: 20,
          toJSON: () => ({}),
        }
    const secondElement = document.createElement('div')
    secondElement.getBoundingClientRect = () => scrolled
      ? {
          bottom: 360,
          height: 300,
          left: 20,
          right: 220,
          top: 60,
          width: 200,
          x: 20,
          y: 60,
          toJSON: () => ({}),
        }
      : {
          bottom: 720,
          height: 300,
          left: 20,
          right: 220,
          top: 420,
          width: 200,
          x: 20,
          y: 420,
          toJSON: () => ({}),
        }
    document.body.append(firstElement, secondElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first',
      formId: 'form-first',
      formLabel: 'First Form',
      id: 'form-first:first',
      kind: 'field',
      order: 1,
    }, firstElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second',
      formId: 'form-second',
      formLabel: 'Second Form',
      id: 'form-second:first',
      kind: 'field',
      order: 1,
    }, secondElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-first"]')?.classList.contains('is-active')).toBe(true)

    scrolled = true
    window.dispatchEvent(new Event('scroll'))

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-second"]')?.classList.contains('is-active')).toBe(true)
    })
  })

  it('does not resync the active ConfigForm when the debugger panel scrolls', async () => {
    installConfigFormDevtools()

    let panelScrolled = false
    const firstElement = document.createElement('div')
    firstElement.getBoundingClientRect = () => panelScrolled
      ? {
          bottom: -120,
          height: 300,
          left: 20,
          right: 220,
          top: -420,
          width: 200,
          x: 20,
          y: -420,
          toJSON: () => ({}),
        }
      : {
          bottom: 320,
          height: 300,
          left: 20,
          right: 220,
          top: 20,
          width: 200,
          x: 20,
          y: 20,
          toJSON: () => ({}),
        }
    const secondElement = document.createElement('div')
    secondElement.getBoundingClientRect = () => panelScrolled
      ? {
          bottom: 360,
          height: 300,
          left: 20,
          right: 220,
          top: 60,
          width: 200,
          x: 20,
          y: 60,
          toJSON: () => ({}),
        }
      : {
          bottom: 720,
          height: 300,
          left: 20,
          right: 220,
          top: 420,
          width: 200,
          x: 20,
          y: 420,
          toJSON: () => ({}),
        }
    document.body.append(firstElement, secondElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first',
      formId: 'form-first',
      formLabel: 'First Form',
      id: 'form-first:first',
      kind: 'field',
      order: 1,
    }, firstElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second',
      formId: 'form-second',
      formLabel: 'Second Form',
      id: 'form-second:first',
      kind: 'field',
      order: 1,
    }, secondElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-first"]')?.classList.contains('is-active')).toBe(true)

    panelScrolled = true
    document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')?.dispatchEvent(new Event('scroll'))
    document.querySelector<HTMLElement>('[data-cf-devtools-node-id="form-first:first"]')?.dispatchEvent(new Event('wheel', { bubbles: true }))
    window.dispatchEvent(new Event('scroll'))

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-first"]')?.classList.contains('is-active')).toBe(true)
  })

  it('keeps display none ConfigForms in the navlist as disabled items', () => {
    installConfigFormDevtools()

    const hiddenPanel = document.createElement('section')
    hiddenPanel.style.display = 'none'
    const hiddenElement = document.createElement('div')
    hiddenElement.getBoundingClientRect = () => ({
      bottom: 320,
      height: 300,
      left: 20,
      right: 220,
      top: 20,
      width: 200,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    })
    hiddenPanel.append(hiddenElement)

    const visibleElement = document.createElement('div')
    visibleElement.getBoundingClientRect = () => ({
      bottom: 420,
      height: 300,
      left: 20,
      right: 220,
      top: 120,
      width: 200,
      x: 20,
      y: 120,
      toJSON: () => ({}),
    })
    document.body.append(hiddenPanel, visibleElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'hidden',
      formId: 'form-hidden',
      formLabel: 'Hidden Form',
      id: 'form-hidden:first',
      kind: 'field',
      order: 1,
    }, hiddenElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'visible',
      formId: 'form-visible',
      formLabel: 'Visible Form',
      id: 'form-visible:first',
      kind: 'field',
      order: 1,
    }, visibleElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    const hiddenNav = document.querySelector<HTMLButtonElement>('[data-cf-devtools-nav-form-id="form-hidden"]')
    expect(hiddenNav?.disabled).toBe(true)
    expect(hiddenNav?.classList.contains('is-disabled')).toBe(true)
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-visible"]')?.classList.contains('is-active')).toBe(true)

    hiddenNav?.click()
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-visible"]')?.classList.contains('is-active')).toBe(true)
    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['form-visible:first'])
  })

  it('syncs the active ConfigForm when a tab switch changes DOM visibility without bridge updates', async () => {
    installConfigFormDevtools()

    let activeTab: 'grid' | 'inline' = 'grid'
    const visibleRect = {
      bottom: 80,
      height: 40,
      left: 20,
      right: 220,
      top: 40,
      width: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    }
    const hiddenRect = {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
    const gridElement = document.createElement('div')
    gridElement.getBoundingClientRect = () => activeTab === 'grid' ? visibleRect : hiddenRect
    const inlineElement = document.createElement('div')
    inlineElement.getBoundingClientRect = () => activeTab === 'inline' ? visibleRect : hiddenRect
    document.body.append(gridElement, inlineElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-grid',
      formLabel: 'element Grid 模式',
      id: 'form-grid:first',
      kind: 'field',
      order: 1,
    }, gridElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'inline',
      formId: 'form-inline',
      formLabel: 'element Inline 模式',
      id: 'form-inline:first',
      kind: 'field',
      order: 1,
    }, inlineElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-grid"]')?.classList.contains('is-active')).toBe(true)

    activeTab = 'inline'
    document.body.classList.add('is-inline-active')

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-inline"]')?.classList.contains('is-active')).toBe(true)
    })
  })

  it('uses viewport score instead of aria-selected when multiple tab panels remain visible', () => {
    installConfigFormDevtools()

    const tabList = document.createElement('div')
    tabList.setAttribute('role', 'tablist')
    const gridTab = document.createElement('button')
    gridTab.id = 'tab-grid'
    gridTab.setAttribute('aria-selected', 'false')
    gridTab.setAttribute('role', 'tab')
    gridTab.textContent = 'element Grid 模式'
    const inlineTab = document.createElement('button')
    inlineTab.id = 'tab-inline'
    inlineTab.setAttribute('aria-selected', 'true')
    inlineTab.setAttribute('role', 'tab')
    inlineTab.textContent = 'element Inline 模式'
    tabList.append(gridTab, inlineTab)

    const gridRect = {
      bottom: 320,
      height: 300,
      left: 20,
      right: 220,
      top: 20,
      width: 200,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    }
    const inlineRect = {
      bottom: 80,
      height: 40,
      left: 20,
      right: 220,
      top: 40,
      width: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    }
    const gridPanel = document.createElement('section')
    gridPanel.setAttribute('aria-labelledby', gridTab.id)
    gridPanel.setAttribute('role', 'tabpanel')
    const gridElement = document.createElement('div')
    gridElement.getBoundingClientRect = () => gridRect
    gridPanel.append(gridElement)

    const inlinePanel = document.createElement('section')
    inlinePanel.setAttribute('aria-labelledby', inlineTab.id)
    inlinePanel.setAttribute('role', 'tabpanel')
    const inlineElement = document.createElement('div')
    inlineElement.getBoundingClientRect = () => inlineRect
    inlinePanel.append(inlineElement)
    document.body.append(tabList, gridPanel, inlinePanel)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-grid',
      formLabel: 'element Grid 模式',
      id: 'form-grid:first',
      kind: 'field',
      order: 1,
    }, gridElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'inline',
      formId: 'form-inline',
      formLabel: 'element Inline 模式',
      id: 'form-inline:first',
      kind: 'field',
      order: 1,
    }, inlineElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-grid"]')?.classList.contains('is-active')).toBe(true)
  })

  it('uses explicit active markers for non-standard containers and syncs keyboard tab changes without animation frames', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    installConfigFormDevtools()

    const measurableRect = {
      bottom: 80,
      height: 40,
      left: 20,
      right: 220,
      top: 40,
      width: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    }
    const gridPanel = document.createElement('section')
    gridPanel.dataset.cfDevtoolsActive = 'true'
    const gridElement = document.createElement('div')
    gridElement.getBoundingClientRect = () => measurableRect
    gridPanel.append(gridElement)

    const inlinePanel = document.createElement('section')
    inlinePanel.dataset.cfDevtoolsActive = 'false'
    const inlineElement = document.createElement('div')
    inlineElement.getBoundingClientRect = () => measurableRect
    inlinePanel.append(inlineElement)
    document.body.append(gridPanel, inlinePanel)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-grid',
      formLabel: 'element Grid 模式',
      id: 'form-grid:first',
      kind: 'field',
      order: 1,
    }, gridElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'inline',
      formId: 'form-inline',
      formLabel: 'element Inline 模式',
      id: 'form-inline:first',
      kind: 'field',
      order: 1,
    }, inlineElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-grid"]')?.classList.contains('is-active')).toBe(true)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
      ?.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }))
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-grid"]')?.classList.contains('is-active')).toBe(true)

    gridPanel.dataset.cfDevtoolsActive = 'false'
    inlinePanel.dataset.cfDevtoolsActive = 'true'
    document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowRight' }))

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-inline"]')?.classList.contains('is-active')).toBe(true)
    })
  })

  it('falls back to the next visible ConfigForm when the active form is removed', () => {
    installConfigFormDevtools()

    const measurableRect = {
      bottom: 80,
      height: 40,
      left: 20,
      right: 220,
      top: 40,
      width: 200,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    }
    const gridElement = document.createElement('div')
    gridElement.getBoundingClientRect = () => measurableRect
    const inlineElement = document.createElement('div')
    inlineElement.getBoundingClientRect = () => measurableRect
    const cardElement = document.createElement('div')
    cardElement.getBoundingClientRect = () => measurableRect
    document.body.append(gridElement, inlineElement, cardElement)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'grid',
      formId: 'form-grid',
      formLabel: 'element Grid 模式',
      id: 'form-grid:first',
      kind: 'field',
      order: 1,
    }, gridElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'inline',
      formId: 'form-inline',
      formLabel: 'element Inline 模式',
      id: 'form-inline:first',
      kind: 'field',
      order: 1,
    }, inlineElement)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'card',
      formId: 'form-card',
      formLabel: 'element Card 模式',
      id: 'form-card:first',
      kind: 'field',
      order: 1,
    }, cardElement)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-grid"]')?.classList.contains('is-active')).toBe(true)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.unregisterField('form-grid:first')

    expect(document.querySelector<HTMLElement>('[data-cf-devtools-nav-form-id="form-inline"]')?.classList.contains('is-active')).toBe(true)
    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['form-inline:first'])
  })

  it('preserves the field registration order for roots and nested slot fields', () => {
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'zeta',
      formId: 'form-1',
      id: 'root-zeta',
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'z-child',
      formId: 'form-1',
      id: 'child-z',
      parentId: 'root-zeta',
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'a-child',
      formId: 'form-1',
      id: 'child-a',
      parentId: 'root-zeta',
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'alpha',
      formId: 'form-1',
      id: 'root-alpha',
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['root-zeta', 'child-z', 'child-a', 'root-alpha'])
  })

  it('drags the bubble, snaps it to an edge, and suppresses the drag click', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')

    if (!bubble || !panel)
      throw new Error('Expected devtools bubble and panel to exist')

    expect(bubble.style.left).toBe('742px')
    expect(bubble.classList.contains('is-right-edge')).toBe(true)

    bubble.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 760,
      clientY: 550,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 20,
      clientY: 80,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(bubble.style.left).toBe('0px')
    expect(bubble.classList.contains('is-left-edge')).toBe(true)
    expect(panel.style.left).toBe('16px')

    bubble.click()
    expect(panel.classList.contains('is-open')).toBe(false)

    bubble.click()
    expect(panel.classList.contains('is-open')).toBe(true)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 300 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 260 })
    window.dispatchEvent(new Event('resize'))

    expect(bubble.style.left).toBe('0px')
    expect(bubble.style.top).toBe('72px')
  })

  it('reserves the scrollbar gutter when the bubble snaps to the right edge', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 })
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 490 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 390 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 900 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')

    if (!bubble || !panel)
      throw new Error('Expected devtools bubble and panel to exist')

    expect(bubble.style.left).toBe('432px')
    expect(panel.style.right).toBe('26px')

    bubble.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 450,
      clientY: 350,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 470,
      clientY: 340,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(bubble.style.left).toBe('448px')
    expect(panel.style.right).toBe('26px')
  })

  it('keeps the debugger panel inside the viewport when opened near the bottom edge', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')

    if (!bubble || !panel)
      throw new Error('Expected devtools bubble and panel to exist')

    bubble.click()

    const panelTop = Number.parseFloat(panel.style.top)
    expect(panelTop + 560).toBeLessThanOrEqual(844 - 16)
  })

  it('keeps the left nav and right tree as independent scroll panes', () => {
    installConfigFormDevtools()

    const style = document.head.textContent ?? ''
    expect(style).toContain('.cf-devtools-panel { position: fixed;')
    expect(style).toContain('overflow: hidden;')
    expect(style).toContain('.cf-devtools-body { min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; overflow: hidden; padding: 8px; }')
    expect(style).toContain('.cf-devtools-nav { min-height: 0; overflow: auto;')
    expect(style).toContain('.cf-devtools-tree { min-height: 0; overflow: auto;')
  })

  it('drags the debugger panel from its header', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')
    const header = document.querySelector<HTMLElement>('.cf-devtools-header')

    if (!bubble || !panel || !header)
      throw new Error('Expected devtools bubble, panel, and header to exist')

    bubble.click()
    panel.getBoundingClientRect = () => ({
      bottom: 420,
      height: 300,
      left: 100,
      right: 520,
      top: 120,
      width: 420,
      x: 100,
      y: 120,
      toJSON: () => ({}),
    })

    header.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 120,
      clientY: 140,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 220,
      clientY: 240,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(panel.style.left).toBe('200px')
    expect(panel.style.top).toBe('220px')
    expect(panel.style.right).toBe('auto')
    expect(panel.style.bottom).toBe('auto')
  })

  it('clamps the dragged debugger panel inside the viewport', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')
    const header = document.querySelector<HTMLElement>('.cf-devtools-header')

    if (!bubble || !panel || !header)
      throw new Error('Expected devtools bubble, panel, and header to exist')

    bubble.click()
    panel.getBoundingClientRect = () => ({
      bottom: 420,
      height: 300,
      left: 100,
      right: 520,
      top: 120,
      width: 420,
      x: 100,
      y: 120,
      toJSON: () => ({}),
    })

    header.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 120,
      clientY: 140,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 900,
      clientY: 900,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(panel.style.left).toBe('364px')
    expect(panel.style.top).toBe('284px')
  })

  it('ignores non-left drag starts and keeps right-edge placement on resize', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')

    if (!bubble || !panel)
      throw new Error('Expected devtools bubble and panel to exist')

    expect(bubble.style.left).toBe('442px')

    bubble.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 2,
      clientX: 450,
      clientY: 350,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(bubble.style.left).toBe('442px')

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 280 })
    window.dispatchEvent(new Event('resize'))

    expect(bubble.style.left).toBe('318px')
    expect(panel.style.right).toBe('16px')
  })

  it('snaps dragged bubbles back to the right edge', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')

    if (!bubble || !panel)
      throw new Error('Expected devtools bubble and panel to exist')

    bubble.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 450,
      clientY: 350,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 451,
      clientY: 300,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(bubble.style.left).toBe('458px')
    expect(bubble.style.top).toBe('292px')
    expect(bubble.classList.contains('is-right-edge')).toBe(true)

    bubble.click()
    expect(panel.classList.contains('is-open')).toBe(false)
  })

  it('keeps normal click behavior after tiny pointer movement', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 })

    installConfigFormDevtools()

    const bubble = document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')
    const panel = document.querySelector<HTMLElement>('[data-cf-devtools="panel"]')

    if (!bubble || !panel)
      throw new Error('Expected devtools bubble and panel to exist')

    bubble.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: 450,
      clientY: 350,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 452,
      clientY: 352,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    bubble.click()

    expect(panel.classList.contains('is-open')).toBe(true)
  })

  it('surfaces source open failures in the panel', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: 'editor failed' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'email',
      formId: 'form-1',
      id: 'node-1',
      source: {
        column: 1,
        file: 'D:/project-new/ConfigForm/playgrounds/element-plus-playground/src/demos/GridForm.vue',
        id: 'source-1',
        line: 1,
      },
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    document.querySelector<HTMLButtonElement>('[data-cf-devtools-open="node-1"]')?.click()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('editor failed')
    })
  })

  it('keeps source open success silent after opening source', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'email',
      formId: 'form-1',
      id: 'node-1',
      source: {
        column: 7,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-1',
        line: 12,
      },
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    document.querySelector<HTMLButtonElement>('[data-cf-devtools-open="node-1"]')?.click()

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(document.body.textContent).not.toContain('Opened source:')
  })

  it('opens source directly when clicking a field row', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'email',
      formId: 'form-1',
      id: 'node-1',
      kind: 'field',
      source: {
        column: 7,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-1',
        line: 12,
      },
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-1"]')?.click()

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/__config-form-devtools/open', expect.objectContaining({
        method: 'POST',
      }))
    })
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-1"]')?.classList.contains('is-selected')).toBe(true)
    expect(document.body.textContent).not.toContain('Opened source:')
  })

  it('opens source directly from the search input by label or component metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'email',
      formId: 'form-1',
      id: 'node-field',
      kind: 'field',
      label: '邮箱',
      order: 1,
      source: {
        column: 7,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-field',
        line: 12,
      },
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      component: 'ElInput',
      formId: 'form-1',
      id: 'node-component',
      kind: 'component',
      order: 2,
      parentId: 'node-field',
      slotName: 'default',
      source: {
        column: 9,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-component',
        line: 24,
      },
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect(document.querySelector('[data-cf-devtools-source-select]')).toBeNull()

    let search = document.querySelector<HTMLInputElement>('[data-cf-devtools-source-search]')
    expect(search).toBeTruthy()

    search!.value = '邮箱'
    search!.dispatchEvent(new Event('input', { bubbles: true }))
    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-source-result-id]')]
      .map(item => item.textContent))
      .toEqual(['F email · 邮箱'])

    search = document.querySelector<HTMLInputElement>('[data-cf-devtools-source-search]')
    search!.value = 'not-found'
    search!.dispatchEvent(new Event('input', { bubbles: true }))
    expect(document.querySelector<HTMLElement>('.cf-devtools-source-empty')?.textContent).toBe('No matching source')

    search = document.querySelector<HTMLInputElement>('[data-cf-devtools-source-search]')
    search!.value = 'slot:default'
    search!.dispatchEvent(new Event('input', { bubbles: true }))

    const results = [...document.querySelectorAll<HTMLButtonElement>('[data-cf-devtools-source-result-id]')]
    expect(results.map(item => item.textContent)).toEqual(['C ElInput · slot:default'])
    results[0]?.click()

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/__config-form-devtools/open', expect.objectContaining({
        method: 'POST',
      }))
    })

    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"line":24')
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"column":9')
    expect(document.body.textContent).not.toContain('Opened source:')
    expect(document.querySelector<HTMLElement>('[data-cf-devtools-node-id="node-component"]')?.classList.contains('is-selected')).toBe(true)
  })

  it('clears source open status when a successful response is not JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('opened', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'email',
      formId: 'form-1',
      id: 'node-1',
      source: {
        column: 7,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-1',
        line: 12,
      },
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    document.querySelector<HTMLButtonElement>('[data-cf-devtools-open="node-1"]')?.click()

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(document.body.textContent).not.toContain('Opened source:')
  })

  it('surfaces plain source open failures when the response is not JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('plain editor failed', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'email',
      formId: 'form-1',
      id: 'node-1',
      source: {
        column: 1,
        file: 'D:/project-new/ConfigForm/playgrounds/element-plus-playground/src/demos/GridForm.vue',
        id: 'source-1',
        line: 1,
      },
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    document.querySelector<HTMLButtonElement>('[data-cf-devtools-open="node-1"]')?.click()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('plain editor failed')
    })
  })

  it('returns the existing bridge on repeated install', () => {
    const first = installConfigFormDevtools()
    const second = installConfigFormDevtools()

    expect(second).toBe(first)
    expect(document.querySelectorAll('#cf-devtools-root')).toHaveLength(1)
  })

  it('dispatches a ready event after installing the bridge', () => {
    const ready = vi.fn()
    window.addEventListener('config-form-devtools:ready', ready)

    const bridge = installConfigFormDevtools()

    expect(ready).toHaveBeenCalledWith(expect.objectContaining({
      detail: bridge,
    }))
    expect(window.__CONFIG_FORM_DEVTOOLS_PENDING__).toBe(true)
  })

  it('throws without a browser document', () => {
    vi.stubGlobal('document', undefined)

    expect(() => installConfigFormDevtools()).toThrow(/requires a browser document/)
  })

  it('updates and unregisters nodes through the bridge', () => {
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'role',
      formId: 'form-1',
      id: 'node-1',
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.recordSync({
      duration: 1.23,
      id: 'node-1',
      timestamp: 1,
    })
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      kind: 'field',
      field: 'role',
      formId: 'form-1',
      id: 'node-1',
      label: '权限',
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.updateField({
      kind: 'field',
      field: 'role',
      formId: 'form-1',
      id: 'node-1',
      label: '角色',
    }, null)

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()
    expect(document.body.textContent).toContain('角色')

    const openSource = document.querySelector<HTMLButtonElement>('[data-cf-devtools-open="node-1"]')
    expect(openSource?.disabled).toBe(true)

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.unregisterField('node-1')
    expect(document.body.textContent).not.toContain('角色')

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.updateField({
      kind: 'field',
      field: 'created-by-update',
      formId: 'form-1',
      id: 'node-2',
      label: '更新创建',
    }, null)
    expect(document.body.textContent).toContain('更新创建')
  })

  it('keeps a form registered when unregistering only one of its nodes', () => {
    installConfigFormDevtools()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'first',
      formId: 'form-1',
      id: 'form-1:first',
      kind: 'field',
      order: 1,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.registerField({
      field: 'second',
      formId: 'form-1',
      id: 'form-1:second',
      kind: 'field',
      order: 2,
    }, null)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__?.unregisterField('form-1:first')

    document.querySelector<HTMLButtonElement>('[data-cf-devtools="bubble"]')?.click()

    expect([...document.querySelectorAll<HTMLElement>('[data-cf-devtools-node-id]')]
      .map(node => node.dataset.cfDevtoolsNodeId))
      .toEqual(['form-1:second'])
  })

  it('throws when a duplicate node id points to a different logical field', () => {
    const bridge = installConfigFormDevtools()

    bridge.registerField({
      field: 'role',
      formId: 'form-1',
      id: 'node-1',
      kind: 'field',
    }, null)

    expect(() => bridge.registerField({
      field: 'status',
      formId: 'form-1',
      id: 'node-1',
      kind: 'field',
    }, null)).toThrow(/Conflicting devtools node id/)
  })

  it('throws when a duplicate node id points to a different source location', () => {
    const bridge = installConfigFormDevtools()

    bridge.registerField({
      field: 'role',
      formId: 'form-1',
      id: 'node-1',
      kind: 'field',
      source: {
        column: 1,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-1',
        line: 1,
      },
    }, null)

    expect(() => bridge.updateField({
      field: 'role',
      formId: 'form-1',
      id: 'node-1',
      kind: 'field',
      source: {
        column: 1,
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        id: 'source-2',
        line: 1,
      },
    }, null)).toThrow(/Conflicting devtools node id/)
  })
})
