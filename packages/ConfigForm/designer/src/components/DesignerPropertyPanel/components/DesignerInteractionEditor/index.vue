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
import { ArrowRightLeft, ChevronDown, Eye, MousePointerClick, Plus, Trash2 } from '@lucide/vue'
import { ElCard, ElCheckbox, ElInput, ElOption, ElSelect } from 'element-plus'
import { computed, ref, watch } from 'vue'
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
type InteractionFilter = 'all' | PrototypeInteraction['kind']
const interactionFilter = ref<InteractionFilter>('all')
const expandedRuleIds = ref(new Set<string>())

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
const filterOptions = computed(() => [
  { value: 'all' as const, label: locale.t('interaction.filter.all', 'All'), count: props.interactions.length },
  { value: 'stateProjection' as const, label: locale.t('interaction.filter.state', 'State'), count: stateRules.value.length },
  { value: 'valueChange' as const, label: locale.t('interaction.filter.value', 'Value'), count: valueRules.value.length },
  { value: 'primaryUiAction' as const, label: locale.t('interaction.filter.primary', 'Actions'), count: primaryRules.value.length },
])
const visibleStateRules = computed(() => interactionFilter.value === 'all' || interactionFilter.value === 'stateProjection' ? stateRules.value : [])
const visibleValueRules = computed(() => interactionFilter.value === 'all' || interactionFilter.value === 'valueChange' ? valueRules.value : [])
const visiblePrimaryRules = computed(() => interactionFilter.value === 'all' || interactionFilter.value === 'primaryUiAction' ? primaryRules.value : [])

watch(() => props.interactions.map(rule => rule.id), (ids) => {
  const validIds = new Set(ids)
  expandedRuleIds.value = new Set([...expandedRuleIds.value].filter(id => validIds.has(id)))
}, { immediate: true })

watch(() => props.node?.id, () => {
  interactionFilter.value = 'all'
})

function nodeLabel(nodeId: string): string {
  const node = props.graph.nodesById[nodeId]
  if (!node)
    return nodeId
  return node.kind === 'field' ? node.label?.trim() || node.field : node.component
    .split(/[.:/]/u)
    .at(-1)
    ?.replace(/[-_]+/gu, ' ')
    .replace(/^\w/u, character => character.toUpperCase()) || node.component
}

function fieldLabel(fieldId: string): string {
  const field = fields.value.find(candidate => candidate.id === fieldId)
  return field?.label ?? field?.field ?? fieldId
}

function fieldLabelByPath(path: string): string {
  const field = fields.value.find(candidate => candidate.field === path)
  return field?.label ?? path
}

function literalLabel(value: unknown): string {
  if (value === null)
    return locale.t('interaction.value.null', 'Null')
  if (typeof value === 'boolean')
    return value ? locale.t('value.true', 'True') : locale.t('value.false', 'False')
  if (typeof value === 'string')
    return value ? `“${value}”` : locale.t('interaction.value.emptyLiteral', 'Empty string')
  return String(value)
}

function expressionLabel(expression: SafeExpression | undefined): string {
  if (!expression)
    return locale.t('interaction.condition.always', 'Always')
  const ast = expression.ast
  if (ast.kind === 'literal')
    return literalLabel(ast.value)
  if (ast.kind === 'reference')
    return ast.scope === 'values'
      ? fieldLabelByPath(ast.path[0] ?? '')
      : ast.path.join('.') || locale.t('interaction.expression.result', 'Action result')
  if (ast.kind === 'binary') {
    const left = ast.left.kind === 'reference'
      ? ast.left.scope === 'values' ? fieldLabelByPath(ast.left.path[0] ?? '') : ast.left.path.join('.')
      : locale.t('interaction.expression.value', 'Value')
    const right = ast.right.kind === 'literal' ? literalLabel(ast.right.value) : locale.t('interaction.expression.value', 'Value')
    return `${left} ${ast.operator} ${right}`
  }
  return locale.t('interaction.expression.advancedSummary', 'Advanced expression')
}

function ruleIcon(kind: PrototypeInteraction['kind']) {
  return kind === 'stateProjection' ? Eye : kind === 'valueChange' ? ArrowRightLeft : MousePointerClick
}

function ruleSummary(rule: PrototypeInteraction): string {
  if (rule.kind === 'stateProjection') {
    const target = rule.target.kind === 'state' ? rule.target : undefined
    return target
      ? `${nodeLabel(target.nodeId)} · ${stateLabel(target.key)}`
      : locale.t('interaction.state.title', 'State linkage')
  }
  if (rule.kind === 'valueChange') {
    const target = fieldLabel(rule.action.targetFieldId)
    if (rule.action.kind === 'copy')
      return `${fieldLabel(rule.action.sourceFieldId)} ${locale.t('interaction.value.copyTo', 'copy to')} ${target}`
    if (rule.action.kind === 'set')
      return `${target} ${locale.t('interaction.value.setTo', 'set to')} ${expressionLabel(rule.action.value)}`
    return `${locale.t('interaction.value.clear', 'Clear')} ${target}`
  }
  return `${nodeLabel(rule.nodeId)} · ${triggerLabel(rule.trigger)}`
}

function ruleDetail(rule: PrototypeInteraction): string {
  if (rule.kind === 'stateProjection')
    return `${locale.t('interaction.condition.when', 'When')} ${expressionLabel(rule.value)}`
  if (rule.kind === 'valueChange') {
    const dependencies = rule.dependencies.map(fieldLabel).join('、')
    return `${locale.t('interaction.value.dependenciesShort', 'When')} ${dependencies || locale.t('interaction.value.anyField', 'a field changes')}${rule.when ? ` · ${locale.t('interaction.condition.when', 'when')} ${expressionLabel(rule.when)}` : ''}`
  }
  const target = targetSurface(rule)
  const action = rule.action.kind === 'navigate' || rule.action.kind === 'open'
    ? `${actionLabel(rule.action.kind)}${target ? ` → ${target.name}` : ''}`
    : actionLabel(rule.action.kind)
  return rule.validate?.scope
    ? `${action} · ${locale.t('interaction.validation.enabledSummary', 'Validate before action')}`
    : action
}

function isRuleExpanded(id: string): boolean {
  return expandedRuleIds.value.has(id)
}

function toggleRule(id: string): void {
  const next = new Set(expandedRuleIds.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  expandedRuleIds.value = next
}

function selectInteractionFilter(filter: InteractionFilter): void {
  interactionFilter.value = filter
}

function expandRule(id: string): void {
  expandedRuleIds.value = new Set([...expandedRuleIds.value, id])
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
  selectInteractionFilter('stateProjection')
  const id = createDesignerCommandId('interaction')
  expandRule(id)
  emit('update', [...props.interactions.map(rule => cloneInteractionJson(rule)), {
    kind: 'stateProjection',
    id,
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
  const dependencyField = fields.value[0]
  const targetField = fields.value.find(field => field.id !== dependencyField?.id)
  if (!dependencyField || !targetField)
    return
  selectInteractionFilter('valueChange')
  const id = createDesignerCommandId('interaction')
  expandRule(id)
  emit('update', [...props.interactions.map(rule => cloneInteractionJson(rule)), {
    kind: 'valueChange',
    id,
    dependencies: [dependencyField.id],
    action: { kind: 'clear', targetFieldId: targetField.id },
  }])
}

function updateDependencies(rule: ValueChangeRule, dependencies: string[]): void {
  const next = dependencies.filter(fieldId => fieldId !== rule.action.targetFieldId)
  if (next.length)
    replaceRule(rule.id, { ...rule, dependencies: next })
}

function updateValueActionKind(rule: ValueChangeRule, kind: 'clear' | 'copy' | 'set'): void {
  const targetFieldId = rule.action.targetFieldId && !rule.dependencies.includes(rule.action.targetFieldId)
    ? rule.action.targetFieldId
    : fields.value.find(field => !rule.dependencies.includes(field.id))?.id
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
  if (rule.dependencies.includes(targetFieldId))
    return
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
  selectInteractionFilter('primaryUiAction')
  const id = createDesignerCommandId('interaction')
  expandRule(id)
  emit('update', [...props.interactions.map(rule => cloneInteractionJson(rule)), {
    kind: 'primaryUiAction',
    id,
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
    <div class="mx-config-form-designer__interaction-toolbar">
      <div class="mx-config-form-designer__interaction-filter" role="group" :aria-label="locale.t('interaction.filter.label', 'Filter interactions')">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          type="button"
          :aria-pressed="interactionFilter === option.value"
          :aria-label="`${option.label} (${option.count})`"
          :data-interaction-filter="option.value"
          @click="selectInteractionFilter(option.value)"
        >
          <span>{{ option.label }}</span>
          <output>{{ option.count }}</output>
        </button>
      </div>
    </div>

    <section v-if="interactionFilter === 'all' || interactionFilter === 'stateProjection'" class="mx-config-form-designer__interaction-section" data-interaction-kind="stateProjection">
      <div class="mx-config-form-designer__interaction-heading">
        <div class="mx-config-form-designer__interaction-heading-copy">
          <span class="mx-config-form-designer__interaction-section-icon" aria-hidden="true"><Eye :size="14" /></span>
          <span>
            <strong>{{ locale.t('interaction.state.title', 'State linkage') }}</strong>
          </span>
        </div>
        <button type="button" class="mx-config-form-designer__interaction-add" :aria-label="locale.t('interaction.state.add', 'Add state rule')" :disabled="readonly || !node" @click="addStateRule">
          <Plus :size="14" aria-hidden="true" />
          <span>{{ locale.t('interaction.add', 'Add rule') }}</span>
        </button>
      </div>
      <div v-if="stateRules.length === 0" class="mx-config-form-designer__interaction-empty">
        <span>{{ locale.t('interaction.state.empty', 'No state rules yet') }}</span>
      </div>
      <ElCard
        v-for="rule in visibleStateRules"
        :key="rule.id"
        shadow="hover"
        class="mx-config-form-designer__interaction-rule"
        :data-interaction-id="rule.id"
        role="group"
        :aria-label="ruleSummary(rule)"
      >
        <template #header>
          <div class="mx-config-form-designer__interaction-rule-heading">
            <button
              type="button"
              class="mx-config-form-designer__interaction-rule-toggle"
              :aria-expanded="isRuleExpanded(rule.id)"
              :aria-controls="`interaction-rule-${rule.id}`"
              :aria-label="locale.t('interaction.editRule', 'Edit {name}', { name: ruleSummary(rule) })"
              @click="toggleRule(rule.id)"
            >
              <span class="mx-config-form-designer__interaction-rule-icon" aria-hidden="true"><component :is="ruleIcon(rule.kind)" :size="13" /></span>
              <span class="mx-config-form-designer__interaction-rule-copy">
                <strong :title="ruleSummary(rule)">{{ ruleSummary(rule) }}</strong>
                <small :title="ruleDetail(rule)">{{ ruleDetail(rule) }}</small>
              </span>
              <ChevronDown :size="14" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('interaction.delete', 'Delete interaction')" :disabled="readonly" @click="removeRule(rule.id)"><Trash2 :size="14" aria-hidden="true" /></button>
          </div>
        </template>
        <div v-show="isRuleExpanded(rule.id)" :id="`interaction-rule-${rule.id}`" class="mx-config-form-designer__interaction-rule-body">
          <div class="mx-config-form-designer__interaction-step">
            <span class="mx-config-form-designer__interaction-step-index">1</span>
            <strong>{{ locale.t('interaction.step.when', 'When') }}</strong>
          </div>
          <div class="mx-config-form-designer__interaction-grid">
            <label class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.target.node', 'Target component') }}</span>
              <ElSelect :model-value="rule.target.nodeId" :disabled="readonly" :aria-label="locale.t('interaction.target.node', 'Target component')" @update:model-value="updateStateNode(rule, $event)">
                <ElOption v-for="item in nodes" :key="item.id" :value="item.id" :label="nodeLabel(item.id)" />
              </ElSelect>
            </label>
            <label v-if="rule.target.kind === 'state'" class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.state.key', 'Projected state') }}</span>
              <ElSelect :model-value="rule.target.key" :disabled="readonly" :aria-label="locale.t('interaction.state.key', 'Projected state')" @update:model-value="updateStateKey(rule, $event)">
                <ElOption v-for="key in stateKeyOptions(rule.target.nodeId)" :key="key" :value="key" :label="stateLabel(key)" />
              </ElSelect>
            </label>
          </div>
          <div class="mx-config-form-designer__interaction-step is-result">
            <span class="mx-config-form-designer__interaction-step-index">2</span>
            <strong>{{ locale.t('interaction.step.condition', 'Condition') }}</strong>
          </div>
          <DesignerSafeExpressionEditor :model-value="rule.value" :fields="fields" purpose="condition" :label="locale.t('interaction.condition.label', 'State condition')" :disabled="readonly" @update:model-value="$event && replaceRule(rule.id, { ...rule, value: $event })" />
        </div>
      </ElCard>
    </section>

    <section v-if="interactionFilter === 'all' || interactionFilter === 'valueChange'" class="mx-config-form-designer__interaction-section" data-interaction-kind="valueChange">
      <div class="mx-config-form-designer__interaction-heading">
        <div class="mx-config-form-designer__interaction-heading-copy">
          <span class="mx-config-form-designer__interaction-section-icon" aria-hidden="true"><ArrowRightLeft :size="14" /></span>
          <span>
            <strong>{{ locale.t('interaction.value.title', 'Value linkage') }}</strong>
          </span>
        </div>
        <button type="button" class="mx-config-form-designer__interaction-add" :aria-label="locale.t('interaction.value.add', 'Add value rule')" :disabled="readonly || fields.length < 2" @click="addValueRule">
          <Plus :size="14" aria-hidden="true" />
          <span>{{ locale.t('interaction.add', 'Add rule') }}</span>
        </button>
      </div>
      <div v-if="valueRules.length === 0" class="mx-config-form-designer__interaction-empty">
        <span>{{ locale.t('interaction.value.empty', 'No value rules yet') }}</span>
      </div>
      <ElCard
        v-for="rule in visibleValueRules"
        :key="rule.id"
        shadow="hover"
        class="mx-config-form-designer__interaction-rule"
        :data-interaction-id="rule.id"
        role="group"
        :aria-label="ruleSummary(rule)"
      >
        <template #header>
          <div class="mx-config-form-designer__interaction-rule-heading">
            <button
              type="button"
              class="mx-config-form-designer__interaction-rule-toggle"
              :aria-expanded="isRuleExpanded(rule.id)"
              :aria-controls="`interaction-rule-${rule.id}`"
              :aria-label="locale.t('interaction.editRule', 'Edit {name}', { name: ruleSummary(rule) })"
              @click="toggleRule(rule.id)"
            >
              <span class="mx-config-form-designer__interaction-rule-icon" aria-hidden="true"><component :is="ruleIcon(rule.kind)" :size="13" /></span>
              <span class="mx-config-form-designer__interaction-rule-copy">
                <strong :title="ruleSummary(rule)">{{ ruleSummary(rule) }}</strong>
                <small :title="ruleDetail(rule)">{{ ruleDetail(rule) }}</small>
              </span>
              <ChevronDown :size="14" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('interaction.delete', 'Delete interaction')" :disabled="readonly" @click="removeRule(rule.id)"><Trash2 :size="14" aria-hidden="true" /></button>
          </div>
        </template>
        <div v-show="isRuleExpanded(rule.id)" :id="`interaction-rule-${rule.id}`" class="mx-config-form-designer__interaction-rule-body">
          <div class="mx-config-form-designer__interaction-step">
            <span class="mx-config-form-designer__interaction-step-index">1</span>
            <strong>{{ locale.t('interaction.step.when', 'When') }}</strong>
          </div>
          <label class="mx-config-form-designer__interaction-field">
            <span>{{ locale.t('interaction.value.dependencies', 'When fields change') }}</span>
            <ElSelect :model-value="rule.dependencies" multiple :disabled="readonly" :aria-label="locale.t('interaction.value.dependencies', 'When fields change')" @update:model-value="updateDependencies(rule, $event)">
              <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
            </ElSelect>
          </label>
          <div class="mx-config-form-designer__interaction-step is-result">
            <span class="mx-config-form-designer__interaction-step-index">2</span>
            <strong>{{ locale.t('interaction.step.then', 'Then') }}</strong>
          </div>
          <div class="mx-config-form-designer__interaction-grid">
            <label class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.value.action', 'Value action') }}</span>
              <ElSelect :model-value="rule.action.kind" :disabled="readonly" :aria-label="locale.t('interaction.value.action', 'Value action')" @update:model-value="updateValueActionKind(rule, $event)">
                <ElOption value="set" :label="locale.t('interaction.value.set', 'Set')" />
                <ElOption value="copy" :label="locale.t('interaction.value.copy', 'Copy')" />
                <ElOption value="clear" :label="locale.t('interaction.value.clear', 'Clear')" />
              </ElSelect>
            </label>
            <label class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.value.target', 'Target field') }}</span>
              <ElSelect :model-value="rule.action.targetFieldId" :disabled="readonly" :aria-label="locale.t('interaction.value.target', 'Target field')" @update:model-value="updateValueTarget(rule, $event)">
                <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" :disabled="rule.dependencies.includes(field.id)" />
              </ElSelect>
            </label>
          </div>
          <label v-if="rule.action.kind === 'copy'" class="mx-config-form-designer__interaction-field">
            <span>{{ locale.t('interaction.value.source', 'Source field') }}</span>
            <ElSelect :model-value="rule.action.sourceFieldId" :disabled="readonly" :aria-label="locale.t('interaction.value.source', 'Source field')" @update:model-value="updateCopySource(rule, $event)">
              <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
            </ElSelect>
          </label>
          <DesignerSafeExpressionEditor v-if="rule.action.kind === 'set'" :model-value="rule.action.value" :fields="fields" purpose="value" :label="locale.t('interaction.value.expression', 'Value to set')" :disabled="readonly" @update:model-value="updateSetValue(rule, $event)" />
          <DesignerSafeExpressionEditor :model-value="rule.when" :fields="fields" purpose="condition" optional :label="locale.t('interaction.condition.optionalLabel', 'Optional condition')" :disabled="readonly" @update:model-value="updateWhen(rule, $event)" />
        </div>
      </ElCard>
    </section>

    <section v-if="interactionFilter === 'all' || interactionFilter === 'primaryUiAction'" class="mx-config-form-designer__interaction-section" data-interaction-kind="primaryUiAction">
      <div class="mx-config-form-designer__interaction-heading">
        <div class="mx-config-form-designer__interaction-heading-copy">
          <span class="mx-config-form-designer__interaction-section-icon" aria-hidden="true"><MousePointerClick :size="14" /></span>
          <span>
            <strong>{{ locale.t('interaction.primary.title', 'UI actions') }}</strong>
          </span>
        </div>
        <button type="button" class="mx-config-form-designer__interaction-add" :aria-label="locale.t('interaction.primary.add', 'Add primary action')" :disabled="readonly || !node || unusedTriggers(node.id).length === 0" @click="addPrimaryRule">
          <Plus :size="14" aria-hidden="true" />
          <span>{{ locale.t('interaction.add', 'Add rule') }}</span>
        </button>
      </div>
      <div v-if="primaryRules.length === 0" class="mx-config-form-designer__interaction-empty">
        <span>{{ locale.t('interaction.primary.empty', 'No UI actions yet') }}</span>
      </div>
      <ElCard
        v-for="rule in visiblePrimaryRules"
        :key="rule.id"
        shadow="hover"
        class="mx-config-form-designer__interaction-rule"
        :data-interaction-id="rule.id"
        role="group"
        :aria-label="ruleSummary(rule)"
      >
        <template #header>
          <div class="mx-config-form-designer__interaction-rule-heading">
            <button
              type="button"
              class="mx-config-form-designer__interaction-rule-toggle"
              :aria-expanded="isRuleExpanded(rule.id)"
              :aria-controls="`interaction-rule-${rule.id}`"
              :aria-label="locale.t('interaction.editRule', 'Edit {name}', { name: ruleSummary(rule) })"
              @click="toggleRule(rule.id)"
            >
              <span class="mx-config-form-designer__interaction-rule-icon" aria-hidden="true"><component :is="ruleIcon(rule.kind)" :size="13" /></span>
              <span class="mx-config-form-designer__interaction-rule-copy">
                <strong :title="ruleSummary(rule)">{{ ruleSummary(rule) }}</strong>
                <small :title="ruleDetail(rule)">{{ ruleDetail(rule) }}</small>
              </span>
              <ChevronDown :size="14" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('interaction.delete', 'Delete interaction')" :disabled="readonly" @click="removeRule(rule.id)"><Trash2 :size="14" aria-hidden="true" /></button>
          </div>
        </template>
        <div v-show="isRuleExpanded(rule.id)" :id="`interaction-rule-${rule.id}`" class="mx-config-form-designer__interaction-rule-body">
          <div class="mx-config-form-designer__interaction-step">
            <span class="mx-config-form-designer__interaction-step-index">1</span>
            <strong>{{ locale.t('interaction.step.when', 'When') }}</strong>
          </div>
          <div class="mx-config-form-designer__interaction-grid">
            <label class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.source.node', 'Source component') }}</span>
              <ElSelect :model-value="rule.nodeId" :disabled="readonly" :aria-label="locale.t('interaction.source.node', 'Source component')" @update:model-value="updatePrimaryNode(rule, $event)">
                <ElOption v-for="item in actionSourceNodes" :key="item.id" :value="item.id" :label="nodeLabel(item.id)" />
              </ElSelect>
            </label>
            <label class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.trigger', 'Trigger') }}</span>
              <ElSelect :model-value="rule.trigger" :disabled="readonly" :aria-label="locale.t('interaction.trigger', 'Trigger')" @update:model-value="replaceRule(rule.id, { ...rule, trigger: $event })">
                <ElOption v-for="trigger in triggersFor(rule.nodeId)" :key="trigger" :value="trigger" :label="triggerLabel(trigger)" />
              </ElSelect>
            </label>
          </div>
          <div class="mx-config-form-designer__interaction-step is-result">
            <span class="mx-config-form-designer__interaction-step-index">2</span>
            <strong>{{ locale.t('interaction.step.then', 'Then') }}</strong>
          </div>
          <label class="mx-config-form-designer__interaction-field">
            <span>{{ locale.t('interaction.action', 'Action') }}</span>
            <ElSelect :model-value="rule.action.kind" :disabled="readonly" :aria-label="locale.t('interaction.action', 'Action')" @update:model-value="updatePrimaryAction(rule, $event)">
              <ElOption v-for="kind in actionKinds" :key="kind" :value="kind" :label="actionLabel(kind)" :disabled="(kind === 'navigate' || kind === 'open') && targetOptions(kind).length === 0" />
            </ElSelect>
          </label>
          <template v-if="rule.action.kind === 'navigate' || rule.action.kind === 'open'">
            <label class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.action.targetSurface', 'Target surface') }}</span>
              <ElSelect :model-value="rule.action.targetSurfaceId" :disabled="readonly" :aria-label="locale.t('interaction.action.targetSurface', 'Target surface')" @update:model-value="updateActionTarget(rule, $event)">
                <ElOption v-for="surface in targetOptions(rule.action.kind)" :key="surface.id" :value="surface.id" :label="`${surface.name} (${surface.kind})`" />
              </ElSelect>
            </label>
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
                      :label="locale.t('interaction.result.value', 'Value to write')"
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
            <label class="mx-config-form-designer__interaction-field">
              <span>{{ locale.t('interaction.output.name', 'Returned result') }}</span>
              <ElSelect
                :model-value="rule.action.result?.name ?? ''"
                :disabled="readonly"
                :aria-label="locale.t('interaction.output.name', 'Returned result')"
                @update:model-value="updateCloseResult(rule, $event)"
              >
                <ElOption value="" :label="locale.t('interaction.output.none', 'Do not return a result')" />
                <ElOption v-for="output in currentSurface.outputs" :key="output.name" :value="output.name" :label="output.name" />
              </ElSelect>
            </label>
            <DesignerSafeExpressionEditor
              v-if="rule.action.result"
              :model-value="rule.action.result.value"
              :fields="fields"
              purpose="value"
              :label="locale.t('interaction.output.value', 'Returned value')"
              :disabled="readonly"
              @update:model-value="updateCloseResultValue(rule, $event)"
            />
          </div>
          <div class="mx-config-form-designer__interaction-step is-condition">
            <span class="mx-config-form-designer__interaction-step-index">3</span>
            <strong>{{ locale.t('interaction.step.guard', 'Guard') }}</strong>
          </div>
          <label class="mx-config-form-designer__interaction-field">
            <span>{{ locale.t('interaction.validation', 'Validate before action') }}</span>
            <ElSelect :model-value="validationScope(rule)" :disabled="readonly" :aria-label="locale.t('interaction.validation', 'Validate before action')" @update:model-value="updateValidationScope(rule, $event)">
              <ElOption value="none" :label="locale.t('interaction.validation.none', 'Do not validate')" />
              <ElOption value="surface" :label="locale.t('interaction.validation.surface', 'Whole surface')" />
              <ElOption value="fields" :label="locale.t('interaction.validation.fields', 'Selected fields')" :disabled="fields.length === 0" />
            </ElSelect>
          </label>
          <label v-if="rule.validate?.scope === 'fields'" class="mx-config-form-designer__interaction-field">
            <span>{{ locale.t('interaction.validation.fieldList', 'Fields to validate') }}</span>
            <ElSelect :model-value="rule.validate.fieldIds" multiple :disabled="readonly" :aria-label="locale.t('interaction.validation.fieldList', 'Fields to validate')" @update:model-value="updateValidationFields(rule, $event)">
              <ElOption v-for="field in fields" :key="field.id" :value="field.id" :label="field.label" />
            </ElSelect>
          </label>
        </div>
      </ElCard>
    </section>

    <p v-if="currentSurface?.kind !== 'page'" class="mx-config-form-designer__interaction-note">
      {{ locale.t('interaction.overlay.note', 'Dialog and Drawer actions may close the current overlay or the complete overlay stack.') }}
    </p>
  </div>
</template>
