// @vitest-environment happy-dom
import type { Component, VNodeChild } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createDevtoolsConfigFormAdapter } from '../src/adapter'

const source = {
  column: 3,
  file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
  id: 'source-1',
  line: 12,
}

interface FieldStub {
  component: unknown
  field?: string
  label?: unknown
  props?: Record<string, unknown>
  slots?: Record<string, unknown>
  __source?: typeof source
}

/**
 * 创建 devtools bridge mock。
 *
 * 每个方法都是 vi.fn，便于断言 adapter 注册、更新、注销和指标上报顺序。
 */
function createBridge() {
  return {
    recordRender: vi.fn(),
    recordSync: vi.fn(),
    registerField: vi.fn(),
    unregisterField: vi.fn(),
    updateField: vi.fn(),
  }
}

const CoreConfigForm = defineComponent({
  name: 'CoreConfigFormStub',
  props: {
    fields: { type: Array, required: true },
    namespace: { type: String, default: 'cf' },
  },
  setup(props, { expose }) {
    expose({
      submit: () => Promise.resolve(true),
    })

    return () => h('form', props.fields.map((field) => {
      const config = field as FieldStub
      return h('div', {
        'class': `${props.namespace}-field`,
        'data-cf-devtools-source-id': config.__source?.id,
      }, [
        h('input', {
          ...(config.props ?? {}),
          id: `${props.namespace}-${config.field}-field`,
          value: '',
        }),
      ])
    }))
  },
})

/**
 * 挂载带默认核心组件的 adapter。
 *
 * 只传入字段树和固定 namespace，测试结束由 afterEach 清理 DOM。
 */
function mountAdapter(fields: FieldStub[]) {
  const Adapter = createDevtoolsConfigFormAdapter({
    ConfigForm: CoreConfigForm as Component,
    collectFieldConfigs: nodes => nodes as never,
  })
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp({
    render: () => h(Adapter, {
      fields,
      namespace: 'demo',
    }),
  })

  app.mount(root)
  return { app, root }
}

/**
 * 创建使用默认核心组件的 devtools adapter。
 *
 * 用于需要自定义挂载方式或响应式 fields 的测试用例。
 */
function createAdapter() {
  return createDevtoolsConfigFormAdapter({
    ConfigForm: CoreConfigForm as Component,
    collectFieldConfigs: nodes => nodes as never,
  })
}

describe('configForm devtools adapter', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __CONFIG_FORM_DEVTOOLS_BRIDGE__?: unknown }).__CONFIG_FORM_DEVTOOLS_BRIDGE__
    vi.restoreAllMocks()
  })

  it('registers rendered ConfigForm fields with source metadata and DOM elements', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    mountAdapter([
      {
        __source: source,
        component: 'input',
        field: 'name',
        label: 'Name',
      },
    ])
    await nextTick()
    await nextTick()

    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      field: 'name',
      formId: expect.stringMatching(/^cf-form-/),
      kind: 'field',
      label: 'Name',
      source,
    }), expect.any(HTMLDivElement))
    const sourceElement = document.querySelector('[data-cf-devtools-source-id="source-1"]')
    expect(sourceElement).toBeInstanceOf(HTMLDivElement)
    expect(sourceElement?.classList.contains('demo-field')).toBe(true)
    expect(sourceElement?.querySelector('input')).toBe(document.getElementById('demo-name-field'))
    expect(bridge.recordSync).toHaveBeenCalledWith(expect.objectContaining({
      duration: expect.any(Number),
      timestamp: expect.any(Number),
    }))
  })

  it('does not resolve field id elements without a source marker', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    const { app } = mountAdapter([{
      component: 'input',
      field: 'email',
    }])
    await nextTick()
    await nextTick()

    expect(document.getElementById('demo-email-field')).toBeInstanceOf(HTMLInputElement)
    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      field: 'email',
      kind: 'field',
    }), null)

    app.unmount()
  })

  it('throws when container props conflict with the injected devtools source id', () => {
    const bridge = createBridge()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    expect(() => mountAdapter([
      {
        __source: source,
        component: 'section',
        props: {
          'data-cf-devtools-source-id': 'different-source',
        },
      },
    ])).toThrow(/Conflicting data-cf-devtools-source-id/)
  })

  it('records sync timing per node without including previous node work', async () => {
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const bridge = createBridge()
    bridge.registerField.mockImplementation((node) => {
      clock += node.field === 'first' ? 5 : 7
    })
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    mountAdapter([
      {
        component: 'input',
        field: 'first',
      },
      {
        component: 'input',
        field: 'second',
      },
    ])
    await nextTick()
    await nextTick()

    const syncMetrics = bridge.recordSync.mock.calls.map(([metric]) => ({
      duration: metric.duration,
      field: bridge.registerField.mock.calls.find(([node]) => node.id === metric.id)?.[0].field,
    }))

    expect(syncMetrics).toEqual([
      { duration: 5, field: 'first' },
      { duration: 7, field: 'second' },
    ])
  })

  it('records render timing from the rendered node vnode lifecycle', async () => {
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    const SlowInput = defineComponent({
      name: 'SlowInput',
      setup(_, { attrs }) {
        return () => {
          clock += 6
          return h('input', attrs)
        }
      },
    })
    const CoreWithConfiguredComponents = defineComponent({
      name: 'CoreWithConfiguredComponents',
      props: {
        fields: { type: Array, required: true },
        namespace: { type: String, default: 'cf' },
      },
      setup(props) {
        return () => h('form', props.fields.map((field) => {
          const config = field as FieldStub
          return h(config.component as Component, {
            ...(config.props ?? {}),
            id: `${props.namespace}-${config.field}-field`,
          })
        }))
      },
    })
    const Adapter = createDevtoolsConfigFormAdapter({
      ConfigForm: CoreWithConfiguredComponents as Component,
      collectFieldConfigs: nodes => nodes as never,
    })
    const root = document.createElement('div')
    document.body.append(root)
    createApp({
      render: () => h(Adapter, {
        fields: [
          {
            component: SlowInput,
            field: 'timed',
          },
        ],
        namespace: 'demo',
      }),
    }).mount(root)
    await nextTick()
    await nextTick()

    expect(bridge.recordRender).toHaveBeenCalledWith(expect.objectContaining({
      duration: 6,
      id: expect.stringMatching(/:timed$/),
      phase: 'mount',
      timestamp: expect.any(Number),
    }))
  })

  it('preserves user vnode lifecycle hooks while adding render timing', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const beforeMount = vi.fn()
    const mounted = vi.fn()

    mountAdapter([
      {
        component: 'input',
        field: 'hooked',
        props: {
          onVnodeBeforeMount: [beforeMount],
          onVnodeMounted: mounted,
        },
      },
    ])
    await nextTick()
    await nextTick()

    expect(beforeMount).toHaveBeenCalled()
    expect(mounted).toHaveBeenCalled()
    expect(bridge.recordRender).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/:hooked$/),
      phase: 'mount',
    }))
  })

  it('records render timing for nodes declared in slot configs', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const CoreWithConfigSlots = defineComponent({
      name: 'CoreWithConfigSlots',
      props: {
        fields: { type: Array, required: true },
        namespace: { type: String, default: 'cf' },
      },
      setup(props) {
        /**
         * 渲染 slot 配置声明的测试节点。
         *
         * 只识别带 component 的对象配置，其余内容按 VNodeChild 原样返回。
         */
        function renderConfigNode(value: unknown): VNodeChild {
          if (!value || typeof value !== 'object' || !('component' in value))
            return value as VNodeChild

          const config = value as FieldStub
          return h('input', {
            ...(config.props ?? {}),
            id: config.field ? `${props.namespace}-${config.field}-field` : undefined,
          })
        }

        return () => h('form', props.fields.map((field) => {
          const config = field as FieldStub
          const slot = config.slots?.default
          const content = slot
          const children = Array.isArray(content)
            ? content.map(renderConfigNode)
            : [renderConfigNode(content)]

          return h('section', config.props ?? {}, children)
        }))
      },
    })
    const Adapter = createDevtoolsConfigFormAdapter({
      ConfigForm: CoreWithConfigSlots as Component,
      collectFieldConfigs: nodes => nodes as never,
    })
    const root = document.createElement('div')
    document.body.append(root)
    createApp({
      render: () => h(Adapter, {
        fields: [
          {
            component: 'section',
            slots: {
              default: {
                component: 'input',
                field: 'slotChild',
              },
            },
          },
        ],
        namespace: 'demo',
      }),
    }).mount(root)
    await nextTick()
    await nextTick()

    expect(bridge.recordRender).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/:slotChild$/),
      phase: 'mount',
    }))
  })

  it('registers slot component nodes as children of their owning field', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    mountAdapter([
      {
        component: 'radio-group',
        field: 'gender',
        slots: {
          default: [
            {
              __source: source,
              component: { name: 'RadioOption' },
            },
          ],
        },
      },
    ])
    await nextTick()
    await nextTick()

    const fieldNode = bridge.registerField.mock.calls.find(([node]) => node.field === 'gender')?.[0]
    const optionNode = bridge.registerField.mock.calls.find(([node]) => node.component === 'RadioOption')?.[0]

    expect(fieldNode).toMatchObject({
      field: 'gender',
      kind: 'field',
    })
    expect(optionNode).toMatchObject({
      kind: 'component',
      parentId: fieldNode.id,
      slotName: 'default',
      source,
    })
  })

  it('registers slot field nodes with source metadata for source jumping', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const childSource = {
      ...source,
      id: 'source-child',
      line: 24,
    }

    mountAdapter([
      {
        component: 'input-group',
        field: 'account',
        slots: {
          default: [
            {
              __source: childSource,
              component: 'input',
              field: 'accountSuffix',
            },
          ],
        },
      },
    ])
    await nextTick()
    await nextTick()

    const fieldNode = bridge.registerField.mock.calls.find(([node]) => node.field === 'account')?.[0]
    const childNode = bridge.registerField.mock.calls.find(([node]) => node.field === 'accountSuffix')?.[0]

    expect(childNode).toMatchObject({
      field: 'accountSuffix',
      kind: 'field',
      parentId: fieldNode.id,
      slotName: 'default',
      source: childSource,
    })
  })

  it('registers nested slot containers and final input nodes with source metadata', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const outerSource = {
      ...source,
      id: 'source-outer',
      line: 20,
    }
    const innerSource = {
      ...source,
      id: 'source-inner',
      line: 24,
    }
    const inputSource = {
      ...source,
      id: 'source-input',
      line: 28,
    }

    mountAdapter([
      {
        __source: outerSource,
        component: { name: 'OuterContainer' },
        slots: {
          default: [
            {
              __source: innerSource,
              component: { name: 'InnerContainer' },
              slots: {
                default: [
                  {
                    __source: inputSource,
                    component: 'input',
                    field: 'nestedInput',
                  },
                ],
              },
            },
          ],
        },
      },
    ])
    await nextTick()
    await nextTick()

    const outerNode = bridge.registerField.mock.calls.find(([node]) => node.component === 'OuterContainer')?.[0]
    const innerNode = bridge.registerField.mock.calls.find(([node]) => node.component === 'InnerContainer')?.[0]
    const inputNode = bridge.registerField.mock.calls.find(([node]) => node.field === 'nestedInput')?.[0]

    expect(outerNode).toMatchObject({
      kind: 'component',
      parentId: undefined,
      source: outerSource,
    })
    expect(innerNode).toMatchObject({
      kind: 'component',
      parentId: outerNode.id,
      slotName: 'default',
      source: innerSource,
    })
    expect(inputNode).toMatchObject({
      field: 'nestedInput',
      kind: 'field',
      parentId: innerNode.id,
      slotName: 'default',
      source: inputSource,
    })
  })

  it('resolves component node elements from their devtools source ids', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const containerSource = {
      ...source,
      id: 'source-container-element',
      line: 20,
    }
    const CoreWithContainer = defineComponent({
      name: 'CoreWithContainer',
      props: {
        fields: { type: Array, required: true },
      },
      setup(props) {
        return () => h('form', props.fields.map((field) => {
          const config = field as FieldStub
          return h('section', config.props ?? {})
        }))
      },
    })
    const Adapter = createDevtoolsConfigFormAdapter({
      ConfigForm: CoreWithContainer as Component,
      collectFieldConfigs: nodes => nodes as never,
    })
    const root = document.createElement('div')
    document.body.append(root)

    const app = createApp({
      render: () => h(Adapter, {
        fields: [
          {
            __source: containerSource,
            component: { name: 'CardContainer' },
          },
        ],
      }),
    })
    app.mount(root)
    await nextTick()
    await nextTick()

    const containerElement = root.querySelector<HTMLElement>('[data-cf-devtools-source-id="source-container-element"]')
    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      component: 'CardContainer',
      kind: 'component',
      source: containerSource,
    }), containerElement)

    app.unmount()
  })

  it('resolves visible source elements before hidden duplicate source nodes', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const sharedSource = {
      ...source,
      id: 'source-shared-container',
      line: 20,
    }

    const CoreWithVisibleContainer = defineComponent({
      name: 'CoreWithVisibleContainer',
      props: {
        fields: { type: Array, required: true },
      },
      setup(props) {
        return () => h('form', props.fields.map((field) => {
          const config = field as FieldStub
          return h('div', [
            h('span', {
              'data-cf-devtools-source-id': config.__source?.id,
              'style': 'display: none;',
            }),
            h('section', {
              'data-cf-devtools-source-id': config.__source?.id,
              'ref': (element) => {
                if (element instanceof HTMLElement) {
                  element.getBoundingClientRect = () => ({
                    bottom: 60,
                    height: 40,
                    left: 10,
                    right: 210,
                    top: 20,
                    width: 200,
                    x: 10,
                    y: 20,
                    toJSON: () => ({}),
                  })
                }
              },
            }),
          ])
        }))
      },
    })
    const Adapter = createDevtoolsConfigFormAdapter({
      ConfigForm: CoreWithVisibleContainer as Component,
      collectFieldConfigs: nodes => nodes as never,
    })
    const root = document.createElement('div')
    document.body.append(root)
    const app = createApp({
      render: () => h(Adapter, {
        fields: [{
          __source: sharedSource,
          component: { name: 'CardContainer' },
        }],
      }),
    })

    app.mount(root)
    await nextTick()
    await nextTick()

    const visibleContainer = root.querySelectorAll<HTMLElement>('[data-cf-devtools-source-id="source-shared-container"]')[1]
    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      component: 'CardContainer',
      kind: 'component',
      source: sharedSource,
    }), visibleContainer)

    app.unmount()
  })

  it('registers the surrounding tab label as the devtools form label', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const label = document.createElement('button')
    label.id = 'tab-nested-card-checkbox'
    label.textContent = 'element Card 嵌套 Checkbox'
    document.body.append(label)

    const Adapter = createAdapter()
    const root = document.createElement('div')
    root.setAttribute('aria-labelledby', label.id)
    root.setAttribute('role', 'tabpanel')
    document.body.append(root)
    const app = createApp({
      render: () => h(Adapter, {
        fields: [
          {
            component: 'input',
            field: 'permissionScopes',
          },
        ],
        namespace: 'demo',
      }),
    })

    app.mount(root)
    await nextTick()
    await nextTick()

    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      field: 'permissionScopes',
      formLabel: 'element Card 嵌套 Checkbox',
    }), null)

    app.unmount()
  })

  it('does not execute function slot content while collecting devtools nodes', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    mountAdapter([
      {
        component: 'input-group',
        field: 'account',
        slots: {
          default: () => {
            throw new Error('function slot should not execute')
          },
        },
      },
    ])
    await nextTick()
    await nextTick()

    expect(bridge.registerField).toHaveBeenCalledTimes(1)
    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      field: 'account',
      kind: 'field',
    }), null)
  })

  it('unregisters devtools nodes when the wrapped form unmounts', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    const { app } = mountAdapter([
      {
        component: 'input',
        field: 'name',
      },
    ])
    await nextTick()
    await nextTick()

    const registeredNode = bridge.registerField.mock.calls[0]?.[0]
    app.unmount()

    expect(bridge.unregisterField).toHaveBeenCalledWith(registeredNode.id)
  })

  it('registers after the devtools bridge becomes ready', async () => {
    const bridge = createBridge()

    mountAdapter([
      {
        component: 'input',
        field: 'late',
      },
    ])
    await nextTick()
    await nextTick()
    expect(bridge.registerField).not.toHaveBeenCalled()

    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    window.dispatchEvent(new CustomEvent('config-form-devtools:ready'))
    await nextTick()
    await nextTick()

    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      field: 'late',
    }), null)
  })

  it('updates existing nodes and unregisters removed fields', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const fields = ref<FieldStub[]>([
      {
        component: 'input',
        field: 'name',
        label: 'Name',
      },
      {
        component: 'input',
        field: 'role',
      },
    ])
    const Adapter = createAdapter()
    const root = document.createElement('div')
    document.body.append(root)
    const app = createApp({
      render: () => h(Adapter, {
        fields: fields.value,
        namespace: 'demo',
      }),
    })

    app.mount(root)
    await nextTick()
    await nextTick()
    const removedId = bridge.registerField.mock.calls.find(([node]) => node.field === 'role')?.[0].id
    bridge.registerField.mockClear()
    bridge.updateField.mockClear()
    bridge.unregisterField.mockClear()

    /**
     * 提供具名函数组件以验证 devtools 能解析函数名。
     *
     * 该测试组件不需要真实渲染，只检查 component 元数据。
     */
    function NamedInput() {}
    fields.value = [
      {
        component: NamedInput,
        field: 'name',
      },
      {
        component: { __name: 'ObjectInput' },
        field: 'email',
      },
    ]
    await nextTick()
    await nextTick()

    expect(bridge.unregisterField).toHaveBeenCalledWith(removedId)
    expect(bridge.updateField).toHaveBeenCalledWith(expect.objectContaining({
      component: 'NamedInput',
      field: 'name',
      label: undefined,
    }), null)
    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      component: 'ObjectInput',
      field: 'email',
    }), null)

    app.unmount()
  })

  it('keeps unnamed component metadata explicit instead of inventing labels', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge
    const anonymousComponent = Object.defineProperty(() => null, 'name', { value: '' })

    mountAdapter([
      {
        component: {},
        field: 'plain',
        label: 123,
      },
      {
        component: anonymousComponent,
        field: 'anonymous',
      },
    ])
    await nextTick()
    await nextTick()

    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      component: undefined,
      field: 'plain',
      label: undefined,
    }), null)
    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      component: undefined,
      field: 'anonymous',
    }), null)
  })

  it('reads object component names when Vue exposes a public name', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    mountAdapter([
      {
        component: { name: 'NamedObjectInput' },
        field: 'named',
      },
    ])
    await nextTick()
    await nextTick()

    expect(bridge.registerField).toHaveBeenCalledWith(expect.objectContaining({
      component: 'NamedObjectInput',
      field: 'named',
    }), null)
  })

  it('proxies exposed ConfigForm methods and throws when the wrapped method is missing', async () => {
    const Adapter = createAdapter()
    const exposed = ref<Record<string, (...args: unknown[]) => unknown> | null>(null)
    const root = document.createElement('div')
    document.body.append(root)
    createApp({
      render: () => h(Adapter, {
        fields: [
          {
            component: 'input',
            field: 'name',
          },
        ],
        namespace: 'demo',
        ref: exposed,
      }),
    }).mount(root)
    await nextTick()

    await expect(exposed.value?.submit()).resolves.toBe(true)
    expect(() => exposed.value?.validate()).toThrow(/is not available/)
  })

  it('does not unregister through a bridge that disappeared before unmount', async () => {
    const bridge = createBridge()
    window.__CONFIG_FORM_DEVTOOLS_BRIDGE__ = bridge

    const { app } = mountAdapter([
      {
        component: 'input',
        field: 'name',
      },
    ])
    await nextTick()
    await nextTick()
    bridge.unregisterField.mockClear()

    delete (window as typeof window & { __CONFIG_FORM_DEVTOOLS_BRIDGE__?: unknown }).__CONFIG_FORM_DEVTOOLS_BRIDGE__
    app.unmount()

    expect(bridge.unregisterField).not.toHaveBeenCalled()
  })
})
