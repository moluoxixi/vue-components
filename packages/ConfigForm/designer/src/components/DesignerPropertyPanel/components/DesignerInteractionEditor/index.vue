<script setup lang="ts">
import type {
  ComponentContract,
  MaterialSemanticTrigger,
  PrimaryUiAction,
  PrimaryUiActionBinding,
  PrototypeInteraction,
  SafeExpression,
  StateProjectionRule,
  SurfaceGraph,
  SurfaceNode,
  ValueChangeRule,
} from '@moluoxixi/config-form-model'
import type { DesignerInteractionFieldOption } from './types'
import type { DesignerInteractionSurfaceOption } from '../../types'
import { Plus, Trash2 } from '@lucide/vue'
import { ElCheckbox, ElInput, ElOption, ElSelect } from 'element-plus'
import { computed } from 'vue'
import { createDesignerCommandId, walkDesignGraph } from '../../../../graph'
import { useDesignerLocale } from '../../../../locale'
import { DesignerSafeExpressionEditor } from './components'

const props = withDefaults(defineProps<{
  componentDefinition?: ComponentContract
  getComponentDefinition?: (component: string) => ComponentContract | undefined
  graph: SurfaceGraph
  interactions?: readonly PrototypeInteraction[]
  node?: SurfaceNode
  readonly?: boolean
  surfaceId?: string
  surfaces?: readonly DesignerInteractionSurfaceOption[]
}>(), {
  interactions: () => [],
  readonly: false,
  surfaces: () => [],
})

const emit = defineEmits<{
  update: [interactions: PrototypeInteraction[]]
}>()

const locale = useDesignerLocale()
const stateKeys = ['visible', 'disabled', 'readonly', 'required'] as const
const actionKinds = ['navigate', 'back', 'open', 'closeCurrent', 'closeAll'] as const

const nodes = computed(() => {
  const result: SurfaceNode[] = []
  walkDesignGraph(props.graph, ({ node }) => result.push(node))
  return result
})
const fields = computed<DesignerInteractionFieldOption[]>(() => nodes.value.flatMap(node => node.kind === 'field'
  ? [{ id: node.id, field: node.field, label: node.label?.trim() || node.field }]
  : []))
const stateRules = computed(() => props.interactions.filter((rule): rule is StateProjectionRule => rule.kind === 'stateProjection'))
const valueRules = computed(() => props.interactions.filter((rule): rule is ValueChangeRule => rule.kind === 'valueChange'))
const primaryRules = computed(() => props.interactions.filter((rule): rule is PrimaryUiActionBinding => rule.kind === 'primaryUiAction'))
const currentSurface = computed(() => props.surfaces.find(surface => surface.id === props.surfaceId))
const actionSourceNodes = computed(() => nodes.value.filter(node => triggersFor(node.id).length > 0))

function nodeLabel(nodeId: string): string {
  const node = props.graph.nodesById[nodeId]
  if (!node)
    return nodeId
  return node.kind === 'field' ? node.label?.trim() || node.field : node.component
}

function definitionFor(nodeId: string): ComponentContract | undefined {
  const node = props.graph.nodesById[nodeId]
  if (!node)
    return undefined
  return node.id === props.node?.id && props.componentDefinition
    ? props.componentDefinition
    : props.getComponentDefinition?.(node.component)
}

function triggersFor(nodeId: string): readonly MaterialSemanticTrigger[] {
  return definitionFor(nodeId)?.semanticTriggers ?? []
}

function defaultCondition(): SafeExpression {
  const field = fields.value[0]
  return field
    ? {
        version: 1,
        ast: {
          kind: 'binary',
          operator: '==',
          left: { kind: 'reference', scope: 'values', path: [field.field] },
          right: { kind: 'literal', value: true },
        },
      }
    : { version: 1, ast: { kind: 'literal', value: true } }
}

function defaultValue(): SafeExpression {
  return { version: 1, ast: { kind: 'literal', value: null } }
}

function defaultResultValue(): SafeExpression {
  return { version: 1, ast: { kind: 'reference', scope: 'result', path: [] } }
}

function defaultOutputValue(): SafeExpression {
  const field = fields.value[0]
  return field
    ? { version: 1, ast: { kind: 'reference', scope: 'values', path: [field.field] } }
    : defaultValue()
}

// Interaction contracts are schema-validated JSON. Vue props are proxies,
// which structuredClone rejects, so normalize through their JSON boundary.
function cloneInteractionJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function replaceRule(id: string, next: PrototypeInteraction): void {
  emit('update', props.interactions.map(rule => cloneInteractionJson(rule.id === id ? next : rule)))
}

function removeRule(id: string): void {
  emit('update', props.interactions.filter(rule => rule.id !== id).map(rule => cloneInteractionJson(rule)))
}

function addStateRule(): void {
  const node = props.node
  if (!node)
    return
  const used = new Set(stateRules.value
    .filter(rule => rule.target.kind === 'state' && rule.target.nodeId === node.id)
    .map(rule => rule.target.kind === 'state' ? rule.target.key : undefined))
  const key = stateKeys.find(candidate => !used.has(candidate))
  if (!key)
    return
  emit('update', [...props.interactions.map(rule => cloneInteractionJson(rule)), {
    kind: 'stateProjection',
    id: createDesignerCommandId('interaction'),
    target: { kind: 'state', nodeId: node.id, key },
    value: defaultCondition(),
  }])
}

function stateKeyOptions(nodeId: string) {
  return stateKeys.filter(key => key !== 'required' || props.graph.nodesById[nodeId]?.kind === 'field')
}

function updateStateNode(rule: StateProjectionRule, nodeId: string): void {
  const keys = stateKeyOptions(nodeId)
  const currentKey = rule.target.kind === 'state' ? rule.target.key : 'visible'
  replaceRule(rule.id, {
    ...rule,
    target: { kind: 'state', nodeId, key: keys.includes(currentKey) ? currentKey : 'visible' },
  })
}

function updateStateKey(rule: StateProjectionRule, key: typeof stateKeys[number]): void {
  replaceRule(rule.id, { ...rule, target: { kind: 'state', nodeId: rule.target.nodeId, key } })
}

function addValueRule(): void {
  const field = fields.value[0]
  if (!field)
    return
  emit('update', [...props.interactions.map(rule => cloneInteractionJson(rule)), {
    kind: 'valueChange',
    id: createDesignerCommandId('interaction'),
    dependencies: [field.id],
    action: { kind: 'clear', targetFieldId: field.id },
  }])
}

function updateDependencies(rule: ValueChangeRule, dependencies: string[]): void {
  if (dependencies.length)
    replaceRule(rule.id, { ...rule, dependencies })
}

function updateValueActionKind(rule: ValueChangeRule, kind: 'clear' | 'copy' | 'set'): void {
  const targetFieldId = rule.action.targetFieldId || fields.value[0]?.id
  if (!targetFieldId)
    return
  const action = kind === 'clear'
    ? { kind, targetFieldId } as const
    : kind === 'copy'
      ? { kind, sourceFieldId: fields.value[0]?.id ?? targetFieldId, targetFieldId } as const
      : { kind, targetFieldId, value: defaultValue() } as const
  replaceRule(rule.id, { ...rule, action })
}

function updateValueTarget(rule: ValueChangeRule, targetFieldId: string): void {
  replaceRule(rule.id, { ...rule, action: { ...rule.action, targetFieldId } })
}

function updateCopySource(rule: ValueChangeRule, sourceFieldId: string): void {
  if (rule.action.kind === 'copy')
    replaceRule(rule.id, { ...rule, action: { ...rule.action, sourceFieldId } })
}

function updateSetValue(rule: ValueChangeRule, value: SafeExpression | undefined): void {
  if (rule.action.kind === 'set' && value)
    replaceRule(rule.id, { ...rule, action: { ...rule.action, value } })
}

function updateWhen(rule: ValueChangeRule, when: SafeExpression | undefined): void {
  const next = cloneInteractionJson(rule)
  if (when)
    next.when = when
  else
    delete next.when
  replaceRule(rule.id, next)
}

function unusedTriggers(nodeId: string): readonly MaterialSemanticTrigger[] {
  const used = new Set(primaryRules.value.filter(rule => rule.nodeId === nodeId).map(rule => rule.trigger))
  return triggersFor(nodeId).filter(trigger => !used.has(trigger))
}

function defaultTarget(kind: 'navigate' | 'open'): DesignerInteractionSurfaceOption | undefined {
  return props.surfaces.find(surface => kind === 'navigate' ? surface.kind === 'page' : surface.kind !== 'page')
}

function parameterDefaults(surface: DesignerInteractionSurfaceOption | undefined) {
  return surface?.parameters
    .filter(parameter => parameter.required && parameter.defaultValue === undefined)
    .map(parameter => ({ name: parameter.name, value: defaultValue() })) ?? []
}

function createAction(kind: typeof actionKinds[number]): PrimaryUiAction | undefined {
  if (kind === 'navigate' || kind === 'open') {
    const target = defaultTarget(kind)
    if (!target)
      return undefined
    const base = { kind, targetSurfaceId: target.id, parameters: parameterDefaults(target) }
    return kind === 'open' ? { ...base, kind } : { ...base, kind }
  }
  return { kind }
}

function addPrimaryRule(): void {
  const node = props.node
  if (!node)
    return
  const trigger = unusedTriggers(node.id)[0]
  const action = createAction('navigate') ?? createAction('open') ?? createAction('back')
  if (!trigger || !action)
    return
  emit('update', [...props.interactions.map(rule => cloneInteractionJson(rule)), {
    kind: 'primaryUiAction',
    id: createDesignerCommandId('interaction'),
    nodeId: node.id,
    trigger,
    action,
  }])
}

function updatePrimaryNode(rule: PrimaryUiActionBinding, nodeId: string): void {
  const trigger = triggersFor(nodeId)[0]
  if (trigger)
    replaceRule(rule.id, { ...rule, nodeId, trigger })
}

function updatePrimaryAction(rule: PrimaryUiActionBinding, kind: typeof actionKinds[number]): void {
  const action = createAction(kind)
  if (action)
    replaceRule(rule.id, { ...rule, action })
}

function targetOptions(kind: 'navigate' | 'open'): readonly DesignerInteractionSurfaceOption[] {
  return props.surfaces.filter(surface => kind === 'navigate' ? surface.kind === 'page' : surface.kind !== 'page')
}

function updateActionTarget(rule: PrimaryUiActionBinding, targetSurfaceId: string): void {
  if (rule.action.kind !== 'navigate' && rule.action.kind !== 'open')
    return
  const target = props.surfaces.find(surface => surface.id === targetSurfaceId)
  const parameters = parameterDefaults(target)
  const action: PrimaryUiAction = rule.action.kind === 'open'
    ? {
        kind: 'open',
        targetSurfaceId,
        parameters,
        ...(rule.action.onResults?.length && target
          ? {
              onResults: rule.action.onResults.filter(binding => (
                target.outputs.some(output => output.name === binding.resultName)
              )),
            }
          : {}),
      }
    : { kind: 'navigate', targetSurfaceId, parameters }
  replaceRule(rule.id, { ...rule, action })
}

function targetSurface(rule: PrimaryUiActionBinding): DesignerInteractionSurfaceOption | undefined {
  const action = rule.action
  return action.kind === 'navigate' || action.kind === 'open'
    ? props.surfaces.find(surface => surface.id === action.targetSurfaceId)
    : undefined
}

function parameterValue(rule: PrimaryUiActionBinding, name: string): SafeExpression | undefined {
  return rule.action.kind === 'navigate' || rule.action.kind === 'open'
    ? rule.action.parameters.find(binding => binding.name === name)?.value
    : undefined
}

function parameterRequired(rule: PrimaryUiActionBinding, name: string): boolean {
  return targetSurface(rule)?.parameters.find(parameter => parameter.name === name)?.required === true
}

function toggleParameter(rule: PrimaryUiActionBinding, name: string, enabled: boolean): void {
  if (rule.action.kind !== 'navigate' && rule.action.kind !== 'open')
    return
  const parameters = enabled
    ? [...rule.action.parameters, { name, value: defaultValue() }]
    : rule.action.parameters.filter(binding => binding.name !== name)
  replaceRule(rule.id, { ...rule, action: { ...rule.action, parameters } })
}

function updateParameter(rule: PrimaryUiActionBinding, name: string, value: SafeExpression | undefined): void {
  if (!value || (rule.action.kind !== 'navigate' && rule.action.kind !== 'open'))
    return
  const parameters = rule.action.parameters.map(binding => binding.name === name ? { ...binding, value } : binding)
  replaceRule(rule.id, { ...rule, action: { ...rule.action, parameters } })
}

function openResultBinding(rule: PrimaryUiActionBinding, resultName: string) {
  return rule.action.kind === 'open'
    ? rule.action.onResults?.find(binding => binding.resultName === resultName)
    : undefined
}

function replaceOpenResults(
  rule: PrimaryUiActionBinding,
  onResults: NonNullable<Extract<PrimaryUiAction, { kind: 'open' }>['onResults']>,
): void {
  if (rule.action.kind !== 'open')
    return
  const action = cloneInteractionJson(rule.action)
  if (onResults.length)
    action.onResults = onResults.map(binding => cloneInteractionJson(binding))
  else
    delete action.onResults
  replaceRule(rule.id, { ...rule, action })
}

function toggleOpenResult(rule: PrimaryUiActionBinding, resultName: string, enabled: boolean): void {
  if (rule.action.kind !== 'open')
    return
  const current = rule.action.onResults ?? []
  if (!enabled) {
    replaceOpenResults(rule, current.filter(binding => binding.resultName !== resultName))
    return
  }
  const target = fields.value[0]
  if (!target || current.some(binding => binding.resultName === resultName))
    return
  replaceOpenResults(rule, [...current, {
    resultName,
    assignments: [{ targetFieldId: target.id, value: defaultResultValue() }],
  }])
}

function addResultAssignment(rule: PrimaryUiActionBinding, resultName: string): void {
  if (rule.action.kind !== 'open')
    return
  const current = rule.action.onResults ?? []
  const binding = current.find(candidate => candidate.resultName === resultName)
  if (!binding)
    return
  const used = new Set(binding.assignments.map(assignment => assignment.targetFieldId))
  const target = fields.value.find(field => !used.has(field.id))
  if (!target)
    return
  replaceOpenResults(rule, current.map(candidate => candidate.resultName === resultName
    ? {
        ...candidate,
        assignments: [...candidate.assignments, {
          targetFieldId: target.id,
          value: defaultResultValue(),
        }],
      }
    : candidate))
}

function removeResultAssignment(
  rule: PrimaryUiActionBinding,
  resultName: string,
  targetFieldId: string,
): void {
  if (rule.action.kind !== 'open')
    return
  const current = rule.action.onResults ?? []
  const binding = current.find(candidate => candidate.resultName === resultName)
  if (!binding)
    return
  if (binding.assignments.length === 1) {
    replaceOpenResults(rule, current.filter(candidate => candidate.resultName !== resultName))
    return
  }
  replaceOpenResults(rule, current.map(candidate => candidate.resultName === resultName
    ? {
        ...candidate,
        assignments: candidate.assignments.filter(assignment => assignment.targetFieldId !== targetFieldId),
      }
    : candidate))
}

function updateResultAssignmentTarget(
  rule: PrimaryUiActionBinding,
  resultName: string,
  previousTargetFieldId: string,
  targetFieldId: string,
): void {
  if (rule.action.kind !== 'open')
    return
  replaceOpenResults(rule, (rule.action.onResults ?? []).map(binding => binding.resultName === resultName
    ? {
        ...binding,
        assignments: binding.assignments.map(assignment => assignment.targetFieldId === previousTargetFieldId
          ? { ...assignment, targetFieldId }
          : assignment),
      }
    : binding))
}

function updateResultAssignmentValue(
  rule: PrimaryUiActionBinding,
  resultName: string,
  targetFieldId: string,
  value: SafeExpression | undefined,
): void {
  if (!value || rule.action.kind !== 'open')
    return
  replaceOpenResults(rule, (rule.action.onResults ?? []).map(binding => binding.resultName === resultName
    ? {
        ...binding,
        assignments: binding.assignments.map(assignment => assignment.targetFieldId === targetFieldId
          ? { ...assignment, value }
          : assignment),
      }
    : binding))
}

function resultTargetUsed(
  rule: PrimaryUiActionBinding,
  resultName: string,
  fieldId: string,
  currentTargetFieldId: string,
): boolean {
  if (fieldId === currentTargetFieldId)
    return false
  return openResultBinding(rule, resultName)?.assignments
    .some(assignment => assignment.targetFieldId === fieldId) === true
}

function updateCloseResult(rule: PrimaryUiActionBinding, name: string): void {
  if (rule.action.kind !== 'closeCurrent')
    return
  const action: Extract<PrimaryUiAction, { kind: 'closeCurrent' }> = name
    ? { kind: 'closeCurrent', result: { name, value: defaultOutputValue() } }
    : { kind: 'closeCurrent' }
  replaceRule(rule.id, { ...rule, action })
}

function updateCloseResultValue(rule: PrimaryUiActionBinding, value: SafeExpression | undefined): void {
  if (!value || rule.action.kind !== 'closeCurrent' || !rule.action.result)
    return
  replaceRule(rule.id, {
    ...rule,
    action: { ...rule.action, result: { ...rule.action.result, value } },
  })
}

function validationScope(rule: PrimaryUiActionBinding): 'fields' | 'none' | 'surface' {
  return rule.validate?.scope ?? 'none'
}

function updateValidationScope(rule: PrimaryUiActionBinding, scope: 'fields' | 'none' | 'surface'): void {
  const next = cloneInteractionJson(rule)
  if (scope === 'none')
    delete next.validate
  else if (scope === 'surface')
    next.validate = { scope }
  else if (fields.value[0])
    next.validate = { scope, fieldIds: [fields.value[0].id] }
  replaceRule(rule.id, next)
}

function updateValidationFields(rule: PrimaryUiActionBinding, fieldIds: string[]): void {
  if (fieldIds.length)
    replaceRule(rule.id, { ...rule, validate: { scope: 'fields', fieldIds } })
}

function stateLabel(key: typeof stateKeys[number]): string {
  return locale.t(`interaction.state.${key}`, key)
}

function triggerLabel(trigger: MaterialSemanticTrigger): string {
  return locale.t(`interaction.trigger.${trigger}`, trigger)
}

function actionLabel(kind: typeof actionKinds[number]): string {
  return locale.t(`interaction.action.${kind}`, kind)
}
</script>

<template>
  <div class="mx-config-form-designer__interaction-editor" data-interaction-editor>
    <p class="mx-config-form-designer__interaction-summary">
      {{ locale.t('interaction.summary', 'Prototype-only behavior using local values. No API calls or custom functions.') }}
    </p>

    <section class="mx-config-form-designer__interaction-section">
      <div class="mx-config-form-designer__interaction-heading">
        <strong>{{ locale.t('interaction.state.title', 'State') }}</strong>
        <button type="button" class="mx-config-form-designer__mini-button" :aria-label="locale.t('interaction.state.add', 'Add state rule')" :disabled="readonly || !node" @click="addStateRule">
          <Plus :size="14" aria-hidden="true" />
        </button>
      </div>
      <p v-if="stateRules.length === 0" class="mx-config-form-designer__interaction-empty">{{ locale.t('interaction.state.empty', 'No state rules') }}</p>
      <article v-for="rule in stateRules" :key="rule.id" class="mx-config-form-designer__interaction-rule" :data-interaction-id="rule.id">
        <div class="mx-config-form-designer__interaction-rule-heading">
          <code>{{ rule.id }}</code>
          <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('interaction.delete', 'Delete interaction')" :disabled="readonly" @click="removeRule(rule.id)"><Trash2 :size="14" aria-hidden="true" /></button>
        </div>
        <div class="mx-config-form-designer__interaction-grid">
          <ElSelect :model-value="rule.target.nodeId" :disabled="readonly" :aria-label="locale.t('interaction.target.node', 'Target component')" @update:model-value="updateStateNode(rule, $event)">
            <ElOption v-for="item in nodes" :key="item.id" :value="item.id" :label="nodeLabel(item.id)" />
          </ElSelect>
          <ElSelect v-if="rule.target.kind === 'state'" :model-value="rule.target.key" :disabled="readonly" :aria-label="locale.t('interaction.state.key', 'Projected state')" @update:model-value="updateStateKey(rule, $event)">
            <ElOption v-for="key in stateKeyOptions(rule.target.nodeId)" :key="key" :value="key" :label="stateLabel(key)" />
          </ElSelect>
        </div>
        <DesignerSafeExpressionEditor :model-value="rule.value" :fields="fields" purpose="condition" :disabled="readonly" @update:model-value="$event && replaceRule(rule.id, { ...rule, value: $event })" />
      </article>
    </section>

    <section class="mx-config-form-designer__interaction-section">
      <div class="mx-config-form-designer__interaction-heading">
        <strong>{{ locale.t('interaction.value.title', 'Value linkage') }}</strong>
        <button type="button" class="mx-config-form-designer__mini-button" :aria-label="locale.t('interaction.value.add', 'Add value rule')" :disabled="readonly || fields.length === 0" @click="addValueRule"><Plus :size="14" aria-hidden="true" /></button>
      </div>
      <p v-if="valueRules.length === 0" class="mx-config-form-designer__interaction-empty">{{ locale.t('interaction.value.empty', 'No value rules') }}</p>
      <article v-for="rule in valueRules" :key="rule.id" class="mx-config-form-designer__interaction-rule" :data-interaction-id="rule.id">
        <div class="mx-config-form-designer__interaction-rule-heading">
          <code>{{ rule.id }}</code>
          <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('interaction.delete', 'Delete interaction')" :disabled="readonly" @click="removeRule(rule.id)"><Trash2 :size="14" aria-hidden="true" /></button>
        </div>
        <label>{{ locale.t('interaction.value.dependencies', 'When fields change') }}</label>
        <ElSelect :model-value="rule.dependencies" multiple :disabled="readonly" :aria-label="locale.t('interaction.value.dependencies', 'When fields change')" @update:model-value="updateDependencies(rule, $event)">
          <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
        </ElSelect>
        <div class="mx-config-form-designer__interaction-grid">
          <ElSelect :model-value="rule.action.kind" :disabled="readonly" :aria-label="locale.t('interaction.value.action', 'Value action')" @update:model-value="updateValueActionKind(rule, $event)">
            <ElOption value="set" :label="locale.t('interaction.value.set', 'Set')" />
            <ElOption value="copy" :label="locale.t('interaction.value.copy', 'Copy')" />
            <ElOption value="clear" :label="locale.t('interaction.value.clear', 'Clear')" />
          </ElSelect>
          <ElSelect :model-value="rule.action.targetFieldId" :disabled="readonly" :aria-label="locale.t('interaction.value.target', 'Target field')" @update:model-value="updateValueTarget(rule, $event)">
            <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
          </ElSelect>
        </div>
        <ElSelect v-if="rule.action.kind === 'copy'" :model-value="rule.action.sourceFieldId" :disabled="readonly" :aria-label="locale.t('interaction.value.source', 'Source field')" @update:model-value="updateCopySource(rule, $event)">
          <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
        </ElSelect>
        <DesignerSafeExpressionEditor v-if="rule.action.kind === 'set'" :model-value="rule.action.value" :fields="fields" purpose="value" :disabled="readonly" @update:model-value="updateSetValue(rule, $event)" />
        <DesignerSafeExpressionEditor :model-value="rule.when" :fields="fields" purpose="condition" optional :disabled="readonly" @update:model-value="updateWhen(rule, $event)" />
      </article>
    </section>

    <section class="mx-config-form-designer__interaction-section">
      <div class="mx-config-form-designer__interaction-heading">
        <strong>{{ locale.t('interaction.primary.title', 'Primary UI action') }}</strong>
        <button type="button" class="mx-config-form-designer__mini-button" :aria-label="locale.t('interaction.primary.add', 'Add primary action')" :disabled="readonly || !node || unusedTriggers(node.id).length === 0" @click="addPrimaryRule"><Plus :size="14" aria-hidden="true" /></button>
      </div>
      <p v-if="primaryRules.length === 0" class="mx-config-form-designer__interaction-empty">{{ locale.t('interaction.primary.empty', 'No primary actions') }}</p>
      <article v-for="rule in primaryRules" :key="rule.id" class="mx-config-form-designer__interaction-rule" :data-interaction-id="rule.id">
        <div class="mx-config-form-designer__interaction-rule-heading">
          <code>{{ rule.id }}</code>
          <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('interaction.delete', 'Delete interaction')" :disabled="readonly" @click="removeRule(rule.id)"><Trash2 :size="14" aria-hidden="true" /></button>
        </div>
        <div class="mx-config-form-designer__interaction-grid">
          <ElSelect :model-value="rule.nodeId" :disabled="readonly" :aria-label="locale.t('interaction.source.node', 'Source component')" @update:model-value="updatePrimaryNode(rule, $event)">
            <ElOption v-for="item in actionSourceNodes" :key="item.id" :value="item.id" :label="nodeLabel(item.id)" />
          </ElSelect>
          <ElSelect :model-value="rule.trigger" :disabled="readonly" :aria-label="locale.t('interaction.trigger', 'Trigger')" @update:model-value="replaceRule(rule.id, { ...rule, trigger: $event })">
            <ElOption v-for="trigger in triggersFor(rule.nodeId)" :key="trigger" :value="trigger" :label="triggerLabel(trigger)" />
          </ElSelect>
        </div>
        <ElSelect :model-value="rule.action.kind" :disabled="readonly" :aria-label="locale.t('interaction.action', 'Action')" @update:model-value="updatePrimaryAction(rule, $event)">
          <ElOption v-for="kind in actionKinds" :key="kind" :value="kind" :label="actionLabel(kind)" :disabled="(kind === 'navigate' || kind === 'open') && targetOptions(kind).length === 0" />
        </ElSelect>
        <template v-if="rule.action.kind === 'navigate' || rule.action.kind === 'open'">
          <ElSelect :model-value="rule.action.targetSurfaceId" :disabled="readonly" :aria-label="locale.t('interaction.action.targetSurface', 'Target surface')" @update:model-value="updateActionTarget(rule, $event)">
            <ElOption v-for="surface in targetOptions(rule.action.kind)" :key="surface.id" :value="surface.id" :label="`${surface.name} (${surface.kind})`" />
          </ElSelect>
          <div v-if="targetSurface(rule)?.parameters.length" class="mx-config-form-designer__interaction-bindings">
            <strong>{{ locale.t('interaction.parameters', 'Parameters') }}</strong>
            <div v-for="parameter in targetSurface(rule)?.parameters" :key="parameter.name" class="mx-config-form-designer__interaction-binding">
              <ElCheckbox :model-value="parameterValue(rule, parameter.name) !== undefined" :disabled="readonly || parameterRequired(rule, parameter.name)" @update:model-value="toggleParameter(rule, parameter.name, $event === true)">
                {{ parameter.name }}<span v-if="parameter.required"> *</span>
              </ElCheckbox>
              <DesignerSafeExpressionEditor v-if="parameterValue(rule, parameter.name)" :model-value="parameterValue(rule, parameter.name)" :fields="fields" purpose="value" :disabled="readonly" @update:model-value="updateParameter(rule, parameter.name, $event)" />
            </div>
          </div>
          <div v-if="rule.action.kind === 'open' && targetSurface(rule)?.outputs.length" class="mx-config-form-designer__interaction-bindings" data-result-bindings>
            <strong>{{ locale.t('interaction.results', 'Result write-back') }}</strong>
            <div v-for="output in targetSurface(rule)?.outputs" :key="output.name" class="mx-config-form-designer__interaction-binding" :data-result-name="output.name">
              <ElCheckbox
                :model-value="openResultBinding(rule, output.name) !== undefined"
                :disabled="readonly || fields.length === 0"
                @update:model-value="toggleOpenResult(rule, output.name, $event === true)"
              >
                {{ output.name }}
              </ElCheckbox>
              <template v-if="openResultBinding(rule, output.name)">
                <div
                  v-for="assignment in openResultBinding(rule, output.name)?.assignments"
                  :key="assignment.targetFieldId"
                  class="mx-config-form-designer__interaction-assignment"
                  :data-result-target="assignment.targetFieldId"
                >
                  <div class="mx-config-form-designer__interaction-assignment-heading">
                    <ElSelect
                      :model-value="assignment.targetFieldId"
                      :disabled="readonly"
                      :aria-label="locale.t('interaction.result.target', 'Write result to field')"
                      @update:model-value="updateResultAssignmentTarget(rule, output.name, assignment.targetFieldId, $event)"
                    >
                      <ElOption
                        v-for="field in fields"
                        :key="field.id"
                        :value="field.id"
                        :label="field.label"
                        :disabled="resultTargetUsed(rule, output.name, field.id, assignment.targetFieldId)"
                      />
                    </ElSelect>
                    <button
                      type="button"
                      class="mx-config-form-designer__mini-button is-danger"
                      :aria-label="locale.t('interaction.result.assignment.delete', 'Delete result assignment')"
                      :disabled="readonly"
                      @click="removeResultAssignment(rule, output.name, assignment.targetFieldId)"
                    ><Trash2 :size="14" aria-hidden="true" /></button>
                  </div>
                  <DesignerSafeExpressionEditor
                    :model-value="assignment.value"
                    :fields="fields"
                    purpose="value"
                    :disabled="readonly"
                    @update:model-value="updateResultAssignmentValue(rule, output.name, assignment.targetFieldId, $event)"
                  />
                </div>
                <button
                  type="button"
                  class="mx-config-form-designer__interaction-command"
                  :disabled="readonly || (openResultBinding(rule, output.name)?.assignments.length ?? 0) >= fields.length"
                  @click="addResultAssignment(rule, output.name)"
                >
                  {{ locale.t('interaction.result.assignment.add', 'Add write-back field') }}
                </button>
              </template>
            </div>
          </div>
        </template>
        <div v-if="rule.action.kind === 'closeCurrent' && currentSurface?.outputs.length" class="mx-config-form-designer__interaction-bindings" data-close-result>
          <strong>{{ locale.t('interaction.output', 'Return result') }}</strong>
          <ElSelect
            :model-value="rule.action.result?.name ?? ''"
            :disabled="readonly"
            :aria-label="locale.t('interaction.output.name', 'Returned result')"
            @update:model-value="updateCloseResult(rule, $event)"
          >
            <ElOption value="" :label="locale.t('interaction.output.none', 'Do not return a result')" />
            <ElOption v-for="output in currentSurface.outputs" :key="output.name" :value="output.name" :label="output.name" />
          </ElSelect>
          <DesignerSafeExpressionEditor
            v-if="rule.action.result"
            :model-value="rule.action.result.value"
            :fields="fields"
            purpose="value"
            :disabled="readonly"
            @update:model-value="updateCloseResultValue(rule, $event)"
          />
        </div>
        <label>{{ locale.t('interaction.validation', 'Validate before action') }}</label>
        <ElSelect :model-value="validationScope(rule)" :disabled="readonly" :aria-label="locale.t('interaction.validation', 'Validate before action')" @update:model-value="updateValidationScope(rule, $event)">
          <ElOption value="none" :label="locale.t('interaction.validation.none', 'Do not validate')" />
          <ElOption value="surface" :label="locale.t('interaction.validation.surface', 'Whole surface')" />
          <ElOption value="fields" :label="locale.t('interaction.validation.fields', 'Selected fields')" :disabled="fields.length === 0" />
        </ElSelect>
        <ElSelect v-if="rule.validate?.scope === 'fields'" :model-value="rule.validate.fieldIds" multiple :disabled="readonly" :aria-label="locale.t('interaction.validation.fieldList', 'Fields to validate')" @update:model-value="updateValidationFields(rule, $event)">
          <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
        </ElSelect>
      </article>
    </section>

    <p v-if="currentSurface?.kind !== 'page'" class="mx-config-form-designer__interaction-note">
      {{ locale.t('interaction.overlay.note', 'Dialog and Drawer actions may close the current overlay or the complete overlay stack.') }}
    </p>
  </div>
</template>
