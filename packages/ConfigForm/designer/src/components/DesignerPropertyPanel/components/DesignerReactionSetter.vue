<script setup lang="ts">
import type {
  ConfigFormJsonValue,
  ConfigFormReaction,
  ConfigFormReactionBranch,
  ConfigFormReactionEffect,
  ConfigFormReactionLiteralKind,
  ConfigFormReactionOperand,
  ConfigFormReactionStateKey,
} from '@moluoxixi/config-form-core'
import {
  appendConfigFormReactionEffect,
  changeConfigFormReactionOperandSource,
  createConfigFormReaction,
  createConfigFormReactionEffect,
  createConfigFormReactionId,
  createConfigFormReactionLiteralOperand,
  createConfigFormReactionPropKey,
  getConfigFormReactionEffects,
  getConfigFormReactionLiteralKind,
  removeConfigFormReactionEffect,
  renameConfigFormReactionProp,
  replaceConfigFormReactionEffect,
  updateConfigFormReactionOperandValue,
  updateConfigFormReactionProp,
  updateConfigFormReactionState,
} from '@moluoxixi/config-form-core'
import { Plus, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
import { useDesignerLocale } from '../../../locale'
import DesignerConditionSetter from './DesignerConditionSetter.vue'

type ReactionBranch = ConfigFormReactionBranch
type LiteralKind = Exclude<ConfigFormReactionLiteralKind, 'complex'>

const props = defineProps<{
  modelValue?: ConfigFormReaction[]
  disabled?: boolean
  fieldOptions?: string[]
  currentField?: string
  reservedIds?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ConfigFormReaction[] | undefined]
}>()

const locale = useDesignerLocale()
const reactions = computed(() => props.modelValue ?? [])
const effectKinds: Array<ConfigFormReactionEffect['kind']> = [
  'setValue',
  'clearValue',
  'setState',
  'setProps',
  'validate',
]
const stateKeys: ConfigFormReactionStateKey[] = ['visible', 'disabled', 'readonly', 'required']

function updateReactions(next: ConfigFormReaction[]): void {
  emit('update:modelValue', next.length ? next : undefined)
}

function replaceReaction(index: number, reaction: ConfigFormReaction): void {
  updateReactions(reactions.value.map((item, itemIndex) => itemIndex === index ? reaction : item))
}

function addReaction(): void {
  const target = props.currentField ?? props.fieldOptions?.[0] ?? ''
  updateReactions([...reactions.value, createConfigFormReaction({
    id: createConfigFormReactionId(reactions.value, 'reaction', props.reservedIds),
    target,
  })])
}

function removeReaction(index: number): void {
  updateReactions(reactions.value.filter((_, itemIndex) => itemIndex !== index))
}

function setReactionId(index: number, value: string): void {
  const reaction = reactions.value[index]!
  const id = value.trim()
  const duplicatesAnotherReaction = id !== reaction.id && props.reservedIds?.includes(id)
  if (id && id !== reaction.id && !duplicatesAnotherReaction)
    replaceReaction(index, { ...reaction, id })
}

function setCondition(index: number, value: ConfigFormReaction['when'] | undefined): void {
  if (value)
    replaceReaction(index, { ...reactions.value[index]!, when: value })
}

function toggleReaction(index: number): void {
  const reaction = reactions.value[index]!
  replaceReaction(index, { ...reaction, enabled: reaction.enabled === false })
}

function branchEffects(
  reaction: ConfigFormReaction,
  branch: ReactionBranch,
): readonly ConfigFormReactionEffect[] {
  return getConfigFormReactionEffects(reaction, branch)
}

function addEffect(reactionIndex: number, branch: ReactionBranch): void {
  const reaction = reactions.value[reactionIndex]!
  const target = props.currentField ?? props.fieldOptions?.[0] ?? ''
  replaceReaction(
    reactionIndex,
    appendConfigFormReactionEffect(
      reaction,
      branch,
      createConfigFormReactionEffect('setState', target),
    ),
  )
}

function removeEffect(reactionIndex: number, branch: ReactionBranch, effectIndex: number): void {
  const reaction = reactions.value[reactionIndex]!
  replaceReaction(
    reactionIndex,
    removeConfigFormReactionEffect(reaction, branch, effectIndex),
  )
}

function replaceEffect(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  effect: ConfigFormReactionEffect,
): void {
  const reaction = reactions.value[reactionIndex]!
  replaceReaction(
    reactionIndex,
    replaceConfigFormReactionEffect(reaction, branch, effectIndex, effect),
  )
}

function changeEffectKind(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  kind: ConfigFormReactionEffect['kind'],
): void {
  const target = branchEffects(reactions.value[reactionIndex]!, branch)[effectIndex]?.target
    ?? props.currentField
    ?? props.fieldOptions?.[0]
    ?? ''
  replaceEffect(
    reactionIndex,
    branch,
    effectIndex,
    createConfigFormReactionEffect(kind, target),
  )
}

function changeTarget(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  target: string,
): void {
  const effect = branchEffects(reactions.value[reactionIndex]!, branch)[effectIndex]!
  replaceEffect(reactionIndex, branch, effectIndex, { ...effect, target })
}

function literalKind(operand: ConfigFormReactionOperand): LiteralKind | 'complex' {
  return getConfigFormReactionLiteralKind(operand)
}

function changeOperandSource(operand: ConfigFormReactionOperand, source: 'field' | 'literal'): ConfigFormReactionOperand {
  return changeConfigFormReactionOperandSource(operand, source, props.fieldOptions?.[0] ?? '')
}

function changeLiteralKind(kind: LiteralKind): ConfigFormReactionOperand {
  return createConfigFormReactionLiteralOperand(kind)
}

function updateOperandValue(operand: ConfigFormReactionOperand, value: ConfigFormJsonValue): ConfigFormReactionOperand {
  return updateConfigFormReactionOperandValue(operand, value)
}

function updateSetValueOperand(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  operand: ConfigFormReactionOperand,
): void {
  const effect = branchEffects(reactions.value[reactionIndex]!, branch)[effectIndex]
  if (effect?.kind === 'setValue')
    replaceEffect(reactionIndex, branch, effectIndex, { ...effect, value: operand })
}

function setStateValue(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  key: ConfigFormReactionStateKey,
  value: 'off' | 'true' | 'false',
): void {
  const effect = branchEffects(reactions.value[reactionIndex]!, branch)[effectIndex]
  if (effect?.kind !== 'setState')
    return
  const nextEffect = updateConfigFormReactionState(
    effect,
    key,
    value === 'off' ? undefined : value === 'true',
  )
  if (nextEffect !== effect)
    replaceEffect(reactionIndex, branch, effectIndex, nextEffect)
}

function stateValue(effect: Extract<ConfigFormReactionEffect, { kind: 'setState' }>, key: ConfigFormReactionStateKey): string {
  return effect.state[key] === undefined ? 'off' : String(effect.state[key])
}

function addProp(reactionIndex: number, branch: ReactionBranch, effectIndex: number): void {
  const effect = branchEffects(reactions.value[reactionIndex]!, branch)[effectIndex]
  if (effect?.kind !== 'setProps')
    return
  const key = createConfigFormReactionPropKey(effect)
  replaceEffect(
    reactionIndex,
    branch,
    effectIndex,
    updateConfigFormReactionProp(effect, key, { kind: 'literal', value: '' }),
  )
}

function renameProp(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  key: string,
  nextKey: string,
): void {
  const effect = branchEffects(reactions.value[reactionIndex]!, branch)[effectIndex]
  if (effect?.kind !== 'setProps')
    return
  const nextEffect = renameConfigFormReactionProp(effect, key, nextKey)
  if (nextEffect !== effect)
    replaceEffect(reactionIndex, branch, effectIndex, nextEffect)
}

function updatePropOperand(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  key: string,
  operand: ConfigFormReactionOperand | undefined,
): void {
  const effect = branchEffects(reactions.value[reactionIndex]!, branch)[effectIndex]
  if (effect?.kind !== 'setProps')
    return
  const nextEffect = updateConfigFormReactionProp(effect, key, operand)
  if (nextEffect !== effect)
    replaceEffect(reactionIndex, branch, effectIndex, nextEffect)
}

function effectLabel(kind: ConfigFormReactionEffect['kind']): string {
  const labels: Record<ConfigFormReactionEffect['kind'], string> = {
    clearValue: locale.t('reaction.effect.clearValue', 'Clear value'),
    setProps: locale.t('reaction.effect.setProps', 'Set props'),
    setState: locale.t('reaction.effect.setState', 'Set state'),
    setValue: locale.t('reaction.effect.setValue', 'Set value'),
    validate: locale.t('reaction.effect.validate', 'Validate'),
  }
  return labels[kind]
}

function inputValue(event: Event): string {
  return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value
}
</script>

<template>
  <div class="mx-config-form-designer__reaction-editor">
    <article v-for="(reaction, reactionIndex) in reactions" :key="reaction.id" class="mx-config-form-designer__reaction-row">
      <header class="mx-config-form-designer__collection-row-heading">
        <input :value="reaction.id" :aria-label="locale.t('reaction.id', 'Reaction id')" :disabled="disabled" @change="setReactionId(reactionIndex, inputValue($event))">
        <button type="button" class="mx-config-form-designer__mini-button" role="switch" :aria-checked="reaction.enabled !== false" :title="locale.t('reaction.enabled', 'Enabled')" :disabled="disabled" @click="toggleReaction(reactionIndex)">
          {{ reaction.enabled === false ? locale.t('switch.off', 'Off') : locale.t('switch.on', 'On') }}
        </button>
        <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('reaction.remove', 'Remove reaction')" :disabled="disabled" @click="removeReaction(reactionIndex)">
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </header>

      <DesignerConditionSetter :model-value="reaction.when" :disabled="disabled" :field-options="fieldOptions" @update:model-value="setCondition(reactionIndex, $event)" />

      <section v-for="branch in (['then', 'else'] as ReactionBranch[])" :key="branch" class="mx-config-form-designer__reaction-branch">
        <strong>{{ branch === 'then' ? locale.t('reaction.then', 'Then') : locale.t('reaction.else', 'Else') }}</strong>
        <div v-for="(effect, effectIndex) in branchEffects(reaction, branch)" :key="effectIndex" class="mx-config-form-designer__reaction-effect">
          <div class="mx-config-form-designer__reaction-effect-heading">
            <select :value="effect.kind" :aria-label="locale.t('reaction.effect', 'Effect')" :disabled="disabled" @change="changeEffectKind(reactionIndex, branch, effectIndex, inputValue($event) as ConfigFormReactionEffect['kind'])">
              <option v-for="kind in effectKinds" :key="kind" :value="kind">{{ effectLabel(kind) }}</option>
            </select>
            <select :value="effect.target" :aria-label="locale.t('reaction.target', 'Target field')" :disabled="disabled" @change="changeTarget(reactionIndex, branch, effectIndex, inputValue($event))">
              <option v-for="field in fieldOptions" :key="field" :value="field">{{ field }}</option>
            </select>
            <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('reaction.removeEffect', 'Remove effect')" :disabled="disabled" @click="removeEffect(reactionIndex, branch, effectIndex)">
              <Trash2 :size="13" aria-hidden="true" />
            </button>
          </div>

          <div v-if="effect.kind === 'setValue'" class="mx-config-form-designer__reaction-operand">
            <select :value="effect.value.kind" :aria-label="locale.t('reaction.valueSource', 'Value source')" :disabled="disabled" @change="updateSetValueOperand(reactionIndex, branch, effectIndex, changeOperandSource(effect.value, inputValue($event) as 'field' | 'literal'))">
              <option value="literal">{{ locale.t('reaction.literal', 'Literal') }}</option>
              <option value="field">{{ locale.t('reaction.fieldValue', 'Field value') }}</option>
            </select>
            <select v-if="effect.value.kind === 'field'" :value="effect.value.field" :aria-label="locale.t('reaction.sourceField', 'Source field')" :disabled="disabled" @change="updateSetValueOperand(reactionIndex, branch, effectIndex, updateOperandValue(effect.value, inputValue($event)))">
              <option v-for="field in fieldOptions" :key="field" :value="field">{{ field }}</option>
            </select>
            <template v-else-if="literalKind(effect.value) !== 'complex'">
              <select :value="literalKind(effect.value)" :aria-label="locale.t('reaction.literalType', 'Literal type')" :disabled="disabled" @change="updateSetValueOperand(reactionIndex, branch, effectIndex, changeLiteralKind(inputValue($event) as LiteralKind))">
                <option value="text">{{ locale.t('valueType.text', 'Text') }}</option>
                <option value="number">{{ locale.t('valueType.number', 'Number') }}</option>
                <option value="boolean">{{ locale.t('valueType.boolean', 'Boolean') }}</option>
              </select>
              <select v-if="literalKind(effect.value) === 'boolean'" :value="String(effect.value.value)" :disabled="disabled" @change="updateSetValueOperand(reactionIndex, branch, effectIndex, updateOperandValue(effect.value, inputValue($event) === 'true'))">
                <option value="true">{{ locale.t('value.true', 'True') }}</option>
                <option value="false">{{ locale.t('value.false', 'False') }}</option>
              </select>
              <input v-else :value="effect.value.value" :type="literalKind(effect.value) === 'number' ? 'number' : 'text'" :disabled="disabled" @change="updateSetValueOperand(reactionIndex, branch, effectIndex, updateOperandValue(effect.value, literalKind(effect.value) === 'number' ? Number(inputValue($event)) : inputValue($event)))">
            </template>
            <output v-else>{{ locale.t('reaction.complexValue', 'Complex value preserved') }}</output>
          </div>

          <div v-else-if="effect.kind === 'setState'" class="mx-config-form-designer__reaction-states">
            <label v-for="key in stateKeys" :key="key">
              <span>{{ locale.t(`condition.target.${key}`, key) }}</span>
              <select :value="stateValue(effect, key)" :disabled="disabled" @change="setStateValue(reactionIndex, branch, effectIndex, key, inputValue($event) as 'off' | 'true' | 'false')">
                <option value="off">{{ locale.t('condition.off', 'Off') }}</option>
                <option value="true">{{ locale.t('value.true', 'True') }}</option>
                <option value="false">{{ locale.t('value.false', 'False') }}</option>
              </select>
            </label>
          </div>

          <div v-else-if="effect.kind === 'setProps'" class="mx-config-form-designer__reaction-props">
            <div v-for="(operand, key) in effect.props" :key="key" class="mx-config-form-designer__reaction-prop">
              <input :value="key" :aria-label="locale.t('reaction.propName', 'Prop name')" :disabled="disabled" @change="renameProp(reactionIndex, branch, effectIndex, key, inputValue($event))">
              <select :value="operand.kind" :disabled="disabled" @change="updatePropOperand(reactionIndex, branch, effectIndex, key, changeOperandSource(operand, inputValue($event) as 'field' | 'literal'))">
                <option value="literal">{{ locale.t('reaction.literal', 'Literal') }}</option>
                <option value="field">{{ locale.t('reaction.fieldValue', 'Field value') }}</option>
              </select>
              <select v-if="operand.kind === 'field'" :value="operand.field" :disabled="disabled" @change="updatePropOperand(reactionIndex, branch, effectIndex, key, updateOperandValue(operand, inputValue($event)))">
                <option v-for="field in fieldOptions" :key="field" :value="field">{{ field }}</option>
              </select>
              <template v-else-if="literalKind(operand) !== 'complex'">
                <select :value="literalKind(operand)" :disabled="disabled" @change="updatePropOperand(reactionIndex, branch, effectIndex, key, changeLiteralKind(inputValue($event) as LiteralKind))">
                  <option value="text">{{ locale.t('valueType.text', 'Text') }}</option>
                  <option value="number">{{ locale.t('valueType.number', 'Number') }}</option>
                  <option value="boolean">{{ locale.t('valueType.boolean', 'Boolean') }}</option>
                </select>
                <select v-if="literalKind(operand) === 'boolean'" :value="String(operand.value)" :disabled="disabled" @change="updatePropOperand(reactionIndex, branch, effectIndex, key, updateOperandValue(operand, inputValue($event) === 'true'))">
                  <option value="true">{{ locale.t('value.true', 'True') }}</option>
                  <option value="false">{{ locale.t('value.false', 'False') }}</option>
                </select>
                <input v-else :value="operand.value" :type="literalKind(operand) === 'number' ? 'number' : 'text'" :disabled="disabled" @change="updatePropOperand(reactionIndex, branch, effectIndex, key, updateOperandValue(operand, literalKind(operand) === 'number' ? Number(inputValue($event)) : inputValue($event)))">
              </template>
              <output v-else>{{ locale.t('reaction.complexValue', 'Complex value preserved') }}</output>
              <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('reaction.removeProp', 'Remove prop')" :disabled="disabled" @click="updatePropOperand(reactionIndex, branch, effectIndex, key, undefined)">
                <Trash2 :size="12" aria-hidden="true" />
              </button>
            </div>
            <button type="button" class="mx-config-form-designer__add-row" :disabled="disabled" @click="addProp(reactionIndex, branch, effectIndex)">
              <Plus :size="13" aria-hidden="true" /> {{ locale.t('reaction.addProp', 'Add prop') }}
            </button>
          </div>
        </div>
        <button type="button" class="mx-config-form-designer__add-row" :disabled="disabled || (branch === 'then' && branchEffects(reaction, branch).length === 0)" @click="addEffect(reactionIndex, branch)">
          <Plus :size="13" aria-hidden="true" /> {{ locale.t('reaction.addEffect', 'Add effect') }}
        </button>
      </section>
    </article>

    <button type="button" class="mx-config-form-designer__add-row" :disabled="disabled" @click="addReaction">
      <Plus :size="14" aria-hidden="true" /> {{ locale.t('reaction.add', 'Add reaction') }}
    </button>
  </div>
</template>
