// @vitest-environment happy-dom
import type {
  ConfigFormFlow,
  ConfigFormFlowActionDescriptor,
  ConfigFormFlowStep,
} from '@moluoxixi/config-form-core'
import type { ProjectCommand, ProjectOperation } from '@moluoxixi/config-form-model'
import type { FlowWorkspaceProps } from '../components/FlowWorkspace'
import {
  CONFIG_FORM_FLOW_VERSION,
  createConfigFormFlowFromSteps,
  readConfigFormFlowSteps,
} from '@moluoxixi/config-form-core'
import { DESIGNER_ZH_CN_MESSAGES } from '@moluoxixi/config-form-designer'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { FlowWorkspace } from '../components'
import { useFlowWorkspace } from '../components/FlowWorkspace/composables'

const PAGE_ID = 'home'
const ECHO_DESCRIPTOR: ConfigFormFlowActionDescriptor = {
  ref: 'test.echo',
  title: 'Echo value',
  category: 'test',
  parameters: [{ name: 'message', title: 'Message', control: 'value', defaultValue: 'ready' }],
  outputs: [{ name: 'value', title: 'Value' }],
  capabilities: [],
}
const REQUIRED_DESCRIPTOR: ConfigFormFlowActionDescriptor = {
  ...ECHO_DESCRIPTOR,
  ref: 'test.required',
  title: 'Required action',
  parameters: [
    { name: 'message', title: 'Message', control: 'text', required: true },
    { name: 'recipient', title: 'Recipient', control: 'text', required: true },
  ],
}
const HTTP_DESCRIPTOR: ConfigFormFlowActionDescriptor = {
  ref: 'test.http',
  title: 'HTTP request',
  category: 'data',
  parameters: [
    { name: 'url', title: 'URL', control: 'text', required: true, defaultValue: 'https://example.test' },
    { name: 'headers', title: 'Headers', control: 'object' },
    { name: 'query', title: 'Query', control: 'object' },
    { name: 'body', title: 'Body', control: 'value' },
  ],
  outputs: [{ name: 'data', title: 'Response data' }],
  capabilities: ['fetch'],
}

function createFlow(
  steps: readonly ConfigFormFlowStep[] = [{ id: 'finish', type: 'terminate', outcome: 'end' }],
  overrides: Partial<ConfigFormFlow> = {},
): ConfigFormFlow {
  const created = createConfigFormFlowFromSteps({
    version: CONFIG_FORM_FLOW_VERSION,
    id: overrides.id ?? 'existing',
    name: overrides.name ?? 'Existing',
    trigger: overrides.trigger ?? { kind: 'form.submit' },
    concurrency: overrides.concurrency ?? 'latest',
    errorPolicy: overrides.errorPolicy ?? { onError: 'failure', timeoutMs: 10000 },
  }, steps)
  if (!created.success)
    throw new Error(created.diagnostics[0]?.message ?? 'Could not create flow fixture.')
  return { ...created.flow, ...overrides }
}

function unsupportedMergeFlow(): ConfigFormFlow {
  return {
    version: CONFIG_FORM_FLOW_VERSION,
    id: 'unsupported',
    name: 'Unsupported merge',
    trigger: { kind: 'form.submit' },
    nodes: [
      { id: 'trigger', type: 'trigger' },
      { id: 'condition', type: 'condition', config: { condition: { kind: 'literal', value: true } } },
      { id: 'left', type: 'action', ref: 'test.echo', config: { input: { message: 'left' } } },
      { id: 'right', type: 'action', ref: 'test.echo', config: { input: { message: 'right' } } },
      { id: 'end', type: 'end' },
    ],
    edges: [
      { id: 'trigger-condition', source: 'trigger', target: 'condition', condition: 'next' },
      { id: 'condition-left', source: 'condition', target: 'left', condition: 'true' },
      { id: 'condition-right', source: 'condition', target: 'right', condition: 'false' },
      { id: 'left-end', source: 'left', target: 'end', condition: 'next' },
      { id: 'right-end', source: 'right', target: 'end', condition: 'next' },
    ],
  }
}

function operationFrom(command: ProjectCommand): ProjectOperation {
  const action = command.actions[0]
  if (action?.type !== 'operation.apply' || action.operations.length !== 1)
    throw new Error('Expected one operation.apply action with one operation.')
  return action.operations[0]!
}

function mountWorkspace(overrides: Partial<FlowWorkspaceProps> = {}) {
  const providedExecute = overrides.execute
  const execute = vi.fn((command: ProjectCommand) => providedExecute
    ? providedExecute(command)
    : Promise.resolve({ changed: true }))
  const wrapper = mount(FlowWorkspace, {
    attachTo: document.body,
    props: {
      actionDescriptors: [ECHO_DESCRIPTOR],
      flows: [],
      initialTrigger: { kind: 'form.submit' },
      pageId: PAGE_ID,
      ...overrides,
      execute,
    },
  })
  return { execute, wrapper }
}

function mountSession(overrides: Partial<FlowWorkspaceProps> = {}) {
  const providedExecute = overrides.execute
  const execute = vi.fn((command: ProjectCommand) => providedExecute
    ? providedExecute(command)
    : Promise.resolve({ changed: true }))
  const close = vi.fn()
  const props = reactive<FlowWorkspaceProps>({
    actionDescriptors: [ECHO_DESCRIPTOR],
    flows: [],
    initialTrigger: { kind: 'form.submit' },
    pageId: PAGE_ID,
    ...overrides,
    execute,
  })
  let session!: ReturnType<typeof useFlowWorkspace>
  const Harness = defineComponent({
    setup() {
      session = useFlowWorkspace({ props: props as unknown as Readonly<FlowWorkspaceProps>, onClose: close })
      return () => h('div')
    },
  })
  const wrapper = mount(Harness)
  return { close, execute, props, session, wrapper }
}

beforeEach(() => {
  const overlays = document.createElement('div')
  overlays.id = 'workbench-overlays'
  document.body.append(overlays)
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('flow workspace draft transaction', () => {
  it('renders Chinese catalog messages and keeps English fallbacks', async () => {
    const { wrapper } = mountWorkspace({
      locale: { locale: 'zh-CN', messages: DESIGNER_ZH_CN_MESSAGES },
    })
    expect(wrapper.get('.flow-workspace').attributes('aria-label')).toBe('事件流程工作区')
    expect(wrapper.get('.flow-empty').text()).toContain('此事件尚未配置流程')

    await wrapper.setProps({ locale: { locale: 'en-US', messages: {} } })
    expect(wrapper.get('.flow-workspace').attributes('aria-label')).toBe('Event flow workspace')
    expect(wrapper.get('.flow-empty').text()).toContain('No flow configured for this event')
  })

  it('keeps creation and edits isolated, then sends exactly one add command on Save', async () => {
    let release!: (value: { changed: boolean }) => void
    const execute = vi.fn((_command: ProjectCommand) => new Promise<{ changed: boolean }>(resolve => release = resolve))
    const { wrapper } = mountWorkspace({ execute })

    await wrapper.get('[data-testid="create-first-flow"]').trigger('click')
    await wrapper.get('[data-testid="add-action"]').trigger('click')
    await wrapper.get('[data-flow-control="name"] input').setValue('Saved flow')
    expect(execute).not.toHaveBeenCalled()

    const firstSave = (wrapper.vm as unknown as { save: () => Promise<boolean> }).save()
    const duplicateSave = (wrapper.vm as unknown as { save: () => Promise<boolean> }).save()
    expect(execute).toHaveBeenCalledTimes(1)
    release({ changed: true })
    await expect(firstSave).resolves.toBe(true)
    await expect(duplicateSave).resolves.toBe(false)

    const command = execute.mock.calls[0]![0]
    expect(command.actions).toHaveLength(1)
    const operation = operationFrom(command)
    expect(operation.type).toBe('flow.add')
    if (operation.type === 'flow.add') {
      expect(operation.pageId).toBe(PAGE_ID)
      expect(operation.flow.name).toBe('Saved flow')
      expect(readConfigFormFlowSteps(operation.flow).steps).toHaveLength(1)
    }
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('discards an edited draft on Cancel without executing a command or mutating props', async () => {
    const flow = createFlow()
    const original = structuredClone(flow)
    const { execute, wrapper } = mountWorkspace({ flows: [flow] })

    await wrapper.get('[data-flow-control="name"] input').setValue('Draft only')
    await wrapper.get('[data-testid="cancel-flow"]').trigger('click')

    expect(execute).not.toHaveBeenCalled()
    expect(flow).toEqual(original)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('retains the draft and diagnostics when the transaction port rejects the command', async () => {
    const execute = vi.fn().mockResolvedValue({
      changed: false,
      diagnostics: [{ code: 'PROJECT_CONFLICT', message: 'Revision changed', path: ['pages', PAGE_ID] }],
    })
    const { wrapper } = mountWorkspace({ execute, flows: [createFlow()] })

    await wrapper.get('[data-flow-control="name"] input').setValue('Still here')
    await wrapper.get('[data-testid="save-flow"]').trigger('click')
    await flushPromises()

    expect(execute).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.get('[data-flow-control="name"] input').element).toHaveProperty('value', 'Still here')
    expect(wrapper.get('.flow-diagnostics').text()).toContain('Revision changed')
  })

  it('retains the draft when execute throws', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('Storage unavailable'))
    const { wrapper } = mountWorkspace({ execute, flows: [createFlow()] })

    await wrapper.get('[data-flow-control="name"] input').setValue('Retry later')
    await wrapper.get('[data-testid="save-flow"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.get('.flow-diagnostics').text()).toContain('Storage unavailable')
    expect(wrapper.get('[data-testid="save-flow"]').attributes('disabled')).toBeUndefined()
  })

  it('detects a same-flow external snapshot change and refuses to overwrite it', async () => {
    const flow = createFlow()
    const { execute, wrapper } = mountWorkspace({ flows: [flow] })
    await wrapper.get('[data-flow-control="name"] input').setValue('Local draft')

    await wrapper.setProps({ flows: [{ ...flow, name: 'External edit' }] })
    await nextTick()

    expect(wrapper.get('.flow-diagnostics').text()).toContain('changed outside the editor')
    expect(wrapper.get('[data-testid="save-flow"]').attributes('disabled')).toBeDefined()
    expect(execute).not.toHaveBeenCalled()
  })

  it('inserts explicit branch steps, reorders conditions, and remaps duplicated internal output references', () => {
    const { execute, session } = mountSession()
    session.addFlow()
    session.addStep('condition')
    const original = session.steps.value[0]!
    expect(original.type).toBe('condition')
    if (original.type !== 'condition')
      return

    session.addStep('action', { parentId: original.id, branch: 'then' })
    const first = originalStep(session.steps.value, original.id, 'then', 0)
    session.addStep('action', { parentId: original.id, branch: 'then' })
    const second = originalStep(session.steps.value, original.id, 'then', 1)
    session.setStepInput({ source: { $ref: { kind: 'output', stepId: first.id, path: ['value'] } } })
    session.addStep('terminate', { parentId: original.id, branch: 'else' })
    session.duplicateStep(original.id)

    expect(session.steps.value).toHaveLength(2)
    const duplicate = session.steps.value[1]!
    expect(duplicate.type).toBe('condition')
    if (duplicate.type !== 'condition')
      return
    expect(duplicate.then.map(step => step.id)).not.toEqual([first.id, second.id])
    const duplicateInput = duplicate.then[1]?.type === 'action' ? duplicate.then[1].input : undefined
    expect(duplicateInput).toEqual({ source: { $ref: { kind: 'output', stepId: duplicate.then[0]!.id, path: ['value'] } } })
    expect(duplicate.else[0]).toMatchObject({ type: 'terminate', outcome: 'end' })

    session.moveStep(duplicate.id, -1)
    expect(session.steps.value[0]?.id).toBe(duplicate.id)
    expect(execute).not.toHaveBeenCalled()
  })

  it('validates required descriptor parameters before calling execute', async () => {
    const { execute, session } = mountSession({ actionDescriptors: [REQUIRED_DESCRIPTOR] })
    session.addFlow()
    session.addStep('action')

    await expect(session.save()).resolves.toBe(false)
    expect(execute).not.toHaveBeenCalled()
    expect(session.diagnostics.value).toHaveLength(2)
    expect(session.diagnostics.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FLOW_ACTION_PARAMETER_REQUIRED', path: expect.arrayContaining(['message']) }),
      expect.objectContaining({ code: 'FLOW_ACTION_PARAMETER_REQUIRED', path: expect.arrayContaining(['recipient']) }),
    ]))
    expect(session.selectedStep.value?.type).toBe('action')
  })

  it('renders every diagnostic with its full path and focuses the selected invalid parameter', async () => {
    const firstId = 'required-first'
    const secondId = 'required-second'
    const flow = createFlow([
      { id: firstId, type: 'action', ref: REQUIRED_DESCRIPTOR.ref, input: {} },
      { id: secondId, type: 'action', ref: REQUIRED_DESCRIPTOR.ref, input: {} },
    ])
    const { execute, wrapper } = mountWorkspace({
      actionDescriptors: [REQUIRED_DESCRIPTOR],
      flows: [flow],
    })

    await expect((wrapper.vm as unknown as { save: () => Promise<boolean> }).save()).resolves.toBe(false)
    await nextTick()

    const items = wrapper.findAll('.flow-diagnostic')
    expect(items).toHaveLength(4)
    expect(items[2]!.text()).toContain('FLOW_ACTION_PARAMETER_REQUIRED')
    expect(items[2]!.text()).toContain(`steps / ${secondId} / input / message`)
    expect(execute).not.toHaveBeenCalled()

    await items[2]!.trigger('click')
    await flushPromises()

    expect(wrapper.get(`[data-step-id="${secondId}"]`).classes()).toContain('is-selected')
    const invalidRows = wrapper.findAll('.flow-parameter-row[aria-invalid="true"]')
    expect(invalidRows).toHaveLength(2)
    const messageRow = wrapper.get('[data-parameter="message"]')
    expect(messageRow.find('[aria-invalid="true"]').exists()).toBe(true)
    expect(messageRow.element.contains(document.activeElement)).toBe(true)
  })

  it('offers only outputs that dominate the selected downstream step', () => {
    const { session } = mountSession()
    session.addFlow()
    session.addStep('action')
    const rootAction = session.steps.value[0]!
    session.addStep('condition')
    const condition = session.steps.value[1]!
    expect(condition.type).toBe('condition')
    if (condition.type !== 'condition')
      return
    session.addStep('action', { parentId: condition.id, branch: 'then' })
    const branchAction = originalStep(session.steps.value, condition.id, 'then', 0)
    session.addStep('action', { index: 2 })

    const outputValues = session.outputOptions.value.map(option => option.value)
    expect(outputValues).toContainEqual({ $ref: { kind: 'output', stepId: rootAction.id } })
    expect(outputValues).toContainEqual({ $ref: { kind: 'output', stepId: rootAction.id, path: ['value'] } })
    expect(JSON.stringify(outputValues)).not.toContain(branchAction.id)
    expect(JSON.stringify(outputValues)).not.toContain('$expression')
    expect(session.outputOptions.value.every(option => !option.label.includes(rootAction.id))).toBe(true)
  })

  it('does not replace an imported unrepresentable DAG and still permits an explicit staged removal', async () => {
    const flow = unsupportedMergeFlow()
    const { execute, session } = mountSession({ flows: [flow] })
    expect(session.representable.value).toBe(false)
    expect(session.steps.value).toEqual([])
    expect(session.diagnostics.value.length).toBeGreaterThan(0)

    await expect(session.save()).resolves.toBe(false)
    expect(execute).not.toHaveBeenCalled()

    session.stageRemoveFlow()
    expect(execute).not.toHaveBeenCalled()
    await expect(session.save()).resolves.toBe(true)
    expect(operationFrom(execute.mock.calls[0]![0])).toEqual({
      type: 'flow.remove',
      pageId: PAGE_ID,
      flowId: flow.id,
    })
  })

  it('stages deletion of an existing flow until Save', async () => {
    const flow = createFlow()
    const { execute, session } = mountSession({ flows: [flow] })
    session.stageRemoveFlow()
    expect(session.removed.value).toBe(true)
    expect(execute).not.toHaveBeenCalled()

    session.restoreRemovedFlow()
    expect(session.removed.value).toBe(false)
    session.stageRemoveFlow()
    await session.save()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(operationFrom(execute.mock.calls[0]![0])).toMatchObject({ type: 'flow.remove', flowId: flow.id })
  })

  it('renders descriptor-driven structured HTTP controls without a JSON editor', async () => {
    const { wrapper } = mountWorkspace({ actionDescriptors: [HTTP_DESCRIPTOR] })
    await wrapper.get('[data-testid="create-first-flow"]').trigger('click')
    await wrapper.get('[data-testid="add-action"]').trigger('click')

    const inputs = wrapper.get('[data-testid="flow-action-inputs"]')
    expect(inputs.find('[data-parameter="headers"]').exists()).toBe(true)
    expect(inputs.find('[data-parameter="query"]').exists()).toBe(true)
    expect(inputs.find('[data-parameter="body"]').exists()).toBe(true)
    expect(inputs.find('textarea').exists()).toBe(false)
    expect(inputs.text()).toContain('Add property')
  })

  it('shows component and field labels without exposing trigger or node IDs as controls', () => {
    const flow = createFlow(undefined, {
      id: 'component-flow',
      trigger: { kind: 'component.event', nodeId: 'internal-submit-id', event: 'click' },
    })
    const { wrapper } = mountWorkspace({
      eventTargets: [{
        component: 'element.button',
        event: 'click',
        eventLabel: 'Click',
        field: 'submitValue',
        nodeId: 'internal-submit-id',
        nodeLabel: 'Submit order',
      }],
      flows: [flow],
      initialTrigger: flow.trigger,
      referenceFields: [{ nodeId: 'internal-submit-id', field: 'submitValue', label: 'Submit value' }],
    })

    expect(wrapper.get('[data-flow-control="locked-trigger"]').text()).toContain('Submit order · Click')
    expect(wrapper.find('[aria-label="Node ID"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('internal-submit-id')
  })

  it('keeps stable node identities separate from reaction field names', () => {
    const { session } = mountSession({
      referenceFields: [{ nodeId: 'email-node', field: 'email', label: 'Email address' }],
    })

    expect(session.fields.value).toEqual([
      { nodeId: 'email-node', field: 'email', label: 'Email address' },
    ])

    session.addFlow()
    session.addStep('condition')
    const condition = session.steps.value[0]
    expect(condition).toMatchObject({
      type: 'condition',
      when: {
        kind: 'compare',
        left: { kind: 'field', field: 'email' },
      },
    })
    expect(JSON.stringify(condition)).not.toContain('email-node')
  })

  it('keeps timeout zero and step execution/stop policies in the draft until Save', async () => {
    const { execute, session } = mountSession()
    session.addFlow()
    session.addStep('action')
    session.updateStepPolicy({
      onError: 'continue',
      timeoutMs: 0,
      when: { kind: 'literal', value: true },
      stopWhen: { kind: 'literal', value: false },
    })
    session.updateFlowTimeout(0)

    expect(execute).not.toHaveBeenCalled()
    expect(session.selectedStep.value).toMatchObject({
      policy: { onError: 'continue', timeoutMs: 0, when: { value: true }, stopWhen: { value: false } },
    })
    expect(session.draftMetadata.value?.errorPolicy?.timeoutMs).toBe(0)

    await session.save()
    const operation = operationFrom(execute.mock.calls[0]![0])
    expect(operation.type).toBe('flow.add')
    if (operation.type === 'flow.add') {
      const read = readConfigFormFlowSteps(operation.flow)
      expect(read.steps[0]).toMatchObject({ policy: { onError: 'continue', timeoutMs: 0 } })
    }
  })

  it('blocks all draft mutations in readonly mode', () => {
    const flow = createFlow()
    const { execute, session } = mountSession({ flows: [flow], readonly: true })
    session.patchMetadata({ name: 'Ignored' })
    session.addStep('action')
    session.stageRemoveFlow()

    expect(session.draftMetadata.value?.name).toBe(flow.name)
    expect(session.steps.value).toHaveLength(1)
    expect(session.removed.value).toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })
})

function originalStep(
  steps: readonly ConfigFormFlowStep[],
  conditionId: string,
  branch: 'then' | 'else',
  index: number,
): ConfigFormFlowStep {
  const condition = steps.find(step => step.id === conditionId)
  if (condition?.type !== 'condition' || !condition[branch][index])
    throw new Error(`Missing ${branch} branch step ${index}.`)
  return condition[branch][index]!
}
