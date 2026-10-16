import type { ComponentContract, ModelJsonObject, ProjectDocument, SurfaceGraph, SurfaceNode } from '@moluoxixi/config-form-model'
import type { PropType } from 'vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createProjectDomainEngine, createProjectSnapshot, PROJECT_DOCUMENT_VERSION, PROJECT_THEME_VERSION, registryLockFingerprint, SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { ElColorPicker, ElInput, ElSelect } from 'element-plus'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { DesignerPropertyPanel } from '../src/components/DesignerPropertyPanel'
import DesignerPropertyForm from '../src/components/DesignerPropertyPanel/components/DesignerPropertyForm/index.vue'
import { useDesignerVisualStyleEntries } from '../src/components/DesignerPropertyPanel/composables/use-designer-visual-style-entries'
import { createNodePathCommand } from '../src/graph'

const wrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

function node(id: string, style?: ModelJsonObject[string]): Extract<SurfaceNode, { kind: 'element' }> {
  return { id, kind: 'element', component: 'test.text', props: { text: id, ...(style === undefined ? {} : { style }) } }
}

function graph(nodes: SurfaceNode[]): SurfaceGraph {
  return {
    version: SURFACE_GRAPH_VERSION,
    form: {},
    props: {},
    root: nodes.map(item => ({ nodeId: item.id, placement: {} })),
    nodesById: Object.fromEntries(nodes.map(item => [item.id, item])),
  }
}

const VisualStyleForm = defineComponent({
  props: {
    nodes: { type: Array as PropType<SurfaceNode[]>, required: true },
    readonly: Boolean,
    query: String,
  },
  emits: {
    update: (key: string, value: string | undefined) => typeof key === 'string' && (value === undefined || typeof value === 'string'),
  },
  setup(props, { emit }) {
    const { entries, layout } = useDesignerVisualStyleEntries({
      nodes: () => props.nodes,
      readonly: () => props.readonly,
      query: () => props.query,
      update: (key, value) => emit('update', key, value),
    })
    return () => h(DesignerPropertyForm, {
      entries: entries.value,
      layout,
      renderer: ConfigFormRenderer,
      readonly: props.readonly,
      identity: props.nodes.map(item => item.id).join(','),
    })
  },
})

function editor(nodes: SurfaceNode[], readonly = false) {
  const wrapper = mount(VisualStyleForm, { props: { nodes, readonly } })
  wrappers.push(wrapper)
  return wrapper
}

function panel(nodes: SurfaceNode[], surfaceId?: string) {
  const contract: ComponentContract = {
    key: 'test.text',
    version: '1',
    kind: 'element',
    props: [],
    bindings: [],
    semanticTriggers: [],
    stateProjectionProperties: [],
    datasetBindings: [],
    resourceBindings: [],
    slots: [],
    allowedParents: [],
    defaults: {},
  }
  const material = {
    key: 'test.text',
    version: 1,
    kind: 'element' as const,
    title: 'Text',
    category: 'Elements',
    runtime: { component: 'span' },
    setters: [],
    createNode: ({ id }: { id: string }) => node(id),
  }
  const wrapper = mount(DesignerPropertyPanel, { props: {
    renderer: ConfigFormRenderer,
    surfaceId,
    graph: graph(nodes),
    node: nodes[0],
    nodes,
    material,
    componentDefinition: contract,
    getMaterial: () => material,
    getComponentDefinition: () => contract,
    diagnostics: [],
  } })
  wrappers.push(wrapper)
  return wrapper
}

describe('visual UI style authoring', () => {
  it('authors controlled lengths, rejects invalid CSS, and clears a single field', async () => {
    const wrapper = editor([node('title', { width: '80%', padding: '8px', customProperty: 'keep' })])
    const width = wrapper.get('[data-visual-field="width"]').getComponent(ElInput)
    expect(width.props('modelValue')).toBe('80%')
    width.vm.$emit('change', '240')
    await nextTick()
    expect(wrapper.emitted('update')).toEqual([['width', '240px']])
    width.vm.$emit('change', 'calc(100% - 20px)')
    await nextTick()
    expect(wrapper.emitted('update')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toContain('px')
    width.vm.$emit('change', '-10px')
    await nextTick()
    expect(wrapper.emitted('update')).toHaveLength(1)
    await wrapper.get('button[aria-label="Reset Width"]').trigger('click')
    expect(wrapper.emitted('update')?.at(-1)).toEqual(['width', undefined])
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.props('nodes')[0]?.props.style).toEqual({ width: '80%', padding: '8px', customProperty: 'keep' })
  })

  it('keeps real text input drafts until blur and reconciles accepted and rejected commands', async () => {
    const wrapper = mount(VisualStyleForm, {
      props: {
        nodes: [node('title', { width: '80%', opacity: 0.5 })],
        onUpdate: (key, next) => {
          if (next === '999px')
            return
          void wrapper.setProps({ nodes: [node('title', { [key]: next!, opacity: 0.5 })] })
        },
      },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('[data-visual-field="width"] input')
    ;(input.element as HTMLInputElement).value = '240'
    await input.trigger('input')
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('240')
    expect(wrapper.emitted('update')).toBeUndefined()
    await input.trigger('change')
    await nextTick()
    expect(wrapper.emitted('update')).toEqual([['width', '240px']])
    expect((input.element as HTMLInputElement).value).toBe('240px')
    ;(input.element as HTMLInputElement).value = '999'
    await input.trigger('input')
    expect((input.element as HTMLInputElement).value).toBe('999')
    await input.trigger('change')
    await nextTick()
    expect(wrapper.emitted('update')?.at(-1)).toEqual(['width', '999px'])
    expect((input.element as HTMLInputElement).value).toBe('240px')
    await wrapper.setProps({ nodes: [node('other', { width: '50%' })] })
    expect((input.element as HTMLInputElement).value).toBe('50%')
  })

  it.each([
    ['mixed', [node('first', { width: '40%' }), node('second', { width: '70%' })]],
    ['cleared', [node('first'), node('second')]],
  ])('discards mixed drafts and errors when authoritative values become %s', async (_, nodes) => {
    const wrapper = editor([node('first', { width: '40%' }), node('second', { width: '60%' })])
    const width = wrapper.get('[data-visual-field="width"]')
    width.getComponent(ElInput).vm.$emit('change', 'invalid')
    await nextTick()
    expect(width.find('[role="status"]').exists()).toBe(true)

    const input = width.get('input')
    ;(input.element as HTMLInputElement).value = '240'
    await input.trigger('input')
    expect((input.element as HTMLInputElement).value).toBe('240')

    await wrapper.setProps({ nodes })

    expect((input.element as HTMLInputElement).value).toBe('')
    expect(width.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.emitted('update')).toBeUndefined()
  })

  it('discards drafts when switching surfaces with the same node identity and value', async () => {
    const selected = node('title', { width: '80%' })
    const wrapper = panel([selected], 'first')
    const input = wrapper.get('[data-visual-field="width"] input')
    ;(input.element as HTMLInputElement).value = '240'
    await input.trigger('input')
    expect((input.element as HTMLInputElement).value).toBe('240')

    await wrapper.setProps({ surfaceId: 'second' })

    expect((wrapper.get('[data-visual-field="width"] input').element as HTMLInputElement).value).toBe('80%')
    expect(wrapper.emitted('updatePath')).toBeUndefined()
    expect(wrapper.emitted('updatePaths')).toBeUndefined()
  })

  it('supports auto, percentages, relative units and negative outer spacing', async () => {
    const wrapper = editor([node('title')])
    wrapper.get('[data-visual-field="width"]').getComponent(ElInput).vm.$emit('change', 'auto')
    wrapper.get('[data-visual-field="height"]').getComponent(ElInput).vm.$emit('change', '50%')
    wrapper.get('[data-visual-field="padding"]').getComponent(ElInput).vm.$emit('change', '1.5rem')
    wrapper.get('[data-visual-field="margin"]').getComponent(ElInput).vm.$emit('change', '-8')
    await nextTick()
    expect(wrapper.emitted('update')).toEqual([
      ['width', 'auto'],
      ['height', '50%'],
      ['padding', '1.5rem'],
      ['margin', '-8px'],
    ])
  })

  it('authors theme colors and concrete colors without exposing arbitrary CSS', async () => {
    const wrapper = editor([node('title', { opacity: 0.5 })])
    const fill = wrapper.get('[data-visual-field="backgroundColor"]')
    fill.getComponent(ElSelect).vm.$emit('change', 'var(--demo-color-primary, #2563EB)')
    fill.getComponent(ElColorPicker).vm.$emit('change', '#11223380')
    fill.getComponent(ElSelect).vm.$emit('change', 'url(https://example.com/image.png)')
    await nextTick()
    expect(wrapper.emitted('update')).toEqual([
      ['backgroundColor', 'var(--demo-color-primary, #2563EB)'],
      ['backgroundColor', '#11223380'],
    ])
  })

  it.each(['width: 50%', [{ width: '50%' }], null, 30])('preserves unsupported style representation %j', async (style) => {
    const wrapper = editor([node('title', style)])
    expect(wrapper.find('[data-visual-style-restricted]').exists()).toBe(true)
    expect(wrapper.findAllComponents(ElInput)).toHaveLength(0)
    expect(wrapper.emitted('update')).toBeUndefined()
  })

  it('blocks the whole mixed selection when one component has a non-object style', () => {
    const wrapper = editor([node('first', { width: '40%' }), node('second', 'width: 60%')])
    expect(wrapper.find('[data-visual-style-restricted]').exists()).toBe(true)
    expect(wrapper.findAllComponents(ElInput)).toHaveLength(0)
  })

  it('preserves kebab-case aliases for visual properties instead of introducing competing styles', () => {
    const style = { 'font-size': '18px', 'fontSize': '16px', '--custom-color': '#123456' }
    const wrapper = editor([node('first', { width: '40%' }), node('second', style)])
    expect(wrapper.find('[data-visual-style-restricted]').exists()).toBe(true)
    expect(wrapper.findAllComponents(ElInput)).toHaveLength(0)
    expect(wrapper.props('nodes')[1]?.props.style).toEqual(style)
    expect(wrapper.emitted('update')).toBeUndefined()
  })

  it('rejects lengths whose numeric normalization produces scientific notation', async () => {
    const wrapper = editor([node('title')])
    const width = wrapper.get('[data-visual-field="width"]').getComponent(ElInput)
    width.vm.$emit('change', '1000000000000000000000px')
    await nextTick()
    expect(wrapper.emitted('update')).toBeUndefined()
    width.vm.$emit('change', '0.0000001rem')
    await nextTick()
    expect(wrapper.emitted('update')).toBeUndefined()
    width.vm.$emit('change', '0.001rem')
    await nextTick()
    expect(wrapper.emitted('update')).toEqual([['width', '0.001rem']])
  })

  it('shows mixed values, honors readonly, and searches visual controls', async () => {
    const wrapper = editor([node('first', { width: '40%' }), node('second', { width: '60%' })])
    const width = wrapper.get('[data-visual-field="width"]').getComponent(ElInput)
    expect(width.props('placeholder')).toBe('Mixed')
    expect(width.props('modelValue')).toBe('')
    await wrapper.setProps({ readonly: true })
    width.vm.$emit('change', '50%')
    await nextTick()
    expect(wrapper.emitted('update')).toBeUndefined()
    expect(width.props('disabled')).toBe(true)
    await wrapper.setProps({ query: 'Fill' })
    expect(wrapper.findAll('[data-visual-field]')).toHaveLength(1)
    expect(wrapper.find('[data-visual-field="backgroundColor"]').exists()).toBe(true)
  })

  it('uses the existing panel path command once for a multi-selection edit', async () => {
    const nodes = [node('first', { width: '40%', opacity: 0.5 }), node('second', { width: '60%', padding: '4px' })]
    const wrapper = panel(nodes)
    wrapper.get('[data-visual-field="width"]').getComponent(ElInput).vm.$emit('change', '75%')
    await nextTick()
    expect(wrapper.emitted('updatePaths')).toEqual([[['first', 'second'], ['props', 'style', 'width'], '75%']])
    expect(wrapper.emitted('updatePath')).toBeUndefined()
  })

  it('persists a multi-selection style edit atomically and undoes it without losing unrelated styles', () => {
    const original = graph([node('first', { width: '40%', opacity: 0.5 }), node('second', { width: '60%', padding: '4px' })])
    const components = { 'test.text': { contractVersion: '1', fingerprint: 'fnv1a:11111111' } }
    const document: ProjectDocument = {
      version: PROJECT_DOCUMENT_VERSION,
      id: 'visual-project',
      name: 'Visual project',
      homeSurfaceId: 'home',
      surfaceOrder: ['home'],
      surfacesById: { home: { id: 'home', kind: 'page', name: 'Home', route: '/', parameters: [], outputs: [], interactions: [], graph: original } },
      datasetOrder: [],
      datasetsById: {},
      resources: {},
      settings: {},
      theme: { version: PROJECT_THEME_VERSION },
      registryLock: { adapter: 'test', version: '1', fingerprint: registryLockFingerprint(components), components },
    }
    const engine = createProjectDomainEngine({ document: createProjectSnapshot(document) })
    const result = engine.execute(createNodePathCommand(original, 'home', ['first', 'second'], ['props', 'style', 'width'], '75%'))
    expect(result.changed).toBe(true)
    expect(engine.snapshot.history.position).toBe(1)
    const edited = engine.snapshot.document.surfacesById.home!.graph
    expect(edited.nodesById.first!.props.style).toEqual({ width: '75%', opacity: 0.5 })
    expect(edited.nodesById.second!.props.style).toEqual({ width: '75%', padding: '4px' })
    const reopened = JSON.parse(JSON.stringify(engine.snapshot.document))
    expect(createProjectDomainEngine({ document: reopened }).snapshot.document.surfacesById.home!.graph).toEqual(edited)
    expect(engine.undo().changed).toBe(true)
    expect(engine.snapshot.document.surfacesById.home!.graph).toEqual(original)
    expect(engine.redo().changed).toBe(true)
    const current: SurfaceGraph = JSON.parse(JSON.stringify(engine.snapshot.document.surfacesById.home!.graph))
    expect(engine.execute(createNodePathCommand(current, 'home', ['first', 'second'], ['props', 'style', 'width'], undefined)).changed).toBe(true)
    const cleared = engine.snapshot.document.surfacesById.home!.graph
    expect(cleared.nodesById.first!.props.style).toEqual({ opacity: 0.5 })
    expect(cleared.nodesById.second!.props.style).toEqual({ padding: '4px' })
  })
})
