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
import { Plus, Trash2 } from '@lucide/vue'
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
import {
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus'
import { computed, ref } from 'vue'
import { useDesignerLocale } from '@designer/locale'
import DesignerConditionSetter from '../DesignerConditionSetter/index.vue'

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

function setReactionEnabled(index: number, enabled: boolean): void {
  const reaction = reactions.value[index]!
  replaceReaction(index, { ...reaction, enabled })
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

/**
 * Reaction ids and prop names are used as `v-for` keys, so committing on every keystroke would
 * remount the row and drop focus. Their inputs keep a local draft and only commit on change.
 */
const keyDrafts = ref<Record<string, string>>({})

function keyDraft(key: string, current: string): string {
  return keyDrafts.value[key] ?? current
}

function updateKeyDraft(key: string, value: string): void {
  keyDrafts.value = { ...keyDrafts.value, [key]: value }
}

function clearKeyDraft(key: string): void {
  const next = { ...keyDrafts.value }
  delete next[key]
  keyDrafts.value = next
}

function commitReactionId(index: number, draftKey: string): void {
  const draft = keyDrafts.value[draftKey]
  if (draft === undefined)
    return
  clearKeyDraft(draftKey)
  setReactionId(index, draft)
}

function commitPropName(
  reactionIndex: number,
  branch: ReactionBranch,
  effectIndex: number,
  current: string,
  draftKey: string,
): void {
  const draft = keyDrafts.value[draftKey]
  if (draft === undefined)
    return
  clearKeyDraft(draftKey)
  renameProp(reactionIndex, branch, effectIndex, current, draft)
}
</script>

<template>
  <div class="mx-config-form-designer__reaction-editor">
    <article v-for="(reaction, reactionIndex) in reactions" :key="reaction.id" class="mx-config-form-designer__reaction-row">
      <header class="mx-config-form-designer__collection-row-heading">
        <ElInput
          :model-value="keyDraft(`reaction-${reactionIndex}`, reaction.id)"
          :aria-label="locale.t('reaction.id', 'Reaction id')"
          :disabled="disabled"
          @update:model-value="updateKeyDraft(`reaction-${reactionIndex}`, $event)"
          @change="commitReactionId(reactionIndex, `reaction-${reactionIndex}`)"
        />
        <ElSwitch
          :model-value="reaction.enabled !== false"
          :title="locale.t('reaction.enabled', 'Enabled')"
          :aria-label="locale.t('reaction.enabled', 'Enabled')"
          :disabled="disabled"
          @change="setReactionEnabled(reactionIndex, $event === true)"
        />
        <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('reaction.remove', 'Remove reaction')" :disabled="disabled" @click="removeReaction(reactionIndex)">
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </header>

      <DesignerConditionSetter :model-value="reaction.when" :disabled="disabled" :field-options="fieldOptions" @update:model-value="setCondition(reactionIndex, $event)" />

      <section v-for="branch in (['then', 'else'] as ReactionBranch[])" :key="branch" class="mx-config-form-designer__reaction-branch">
        <strong>{{ branch === 'then' ? locale.t('reaction.then', 'Then') : locale.t('reaction.else', 'Else') }}</strong>
        <div v-for="(effect, effectIndex) in branchEffects(reaction, branch)" :key="effectIndex" class="mx-config-form-designer__reaction-effect">
          <div class="mx-config-form-designer__reaction-effect-heading">
            <ElSelect :model-value="effect.kind" :aria-label="locale.t('reaction.effect', 'Effect')" :disabled="disabled" @update:model-value="changeEffectKind(reactionIndex, branch, effectIndex, $event as ConfigFormReactionEffect['kind'])">
              <ElOption v-for="kind in effectKinds" :key="kind" :value="kind" :label="effectLabel(kind)" />
            </ElSelect>
            <ElSelect :model-value="effect.target" :aria-label="locale.t('reaction.target', 'Target field')" :disabled="disabled" @update:model-value="changeTarget(reactionIndex, branch, effectIndex, String($event))">
              <ElOption v-for="field in fieldOptions" :key="field" :value="field" :label="field" />
            </ElSelect>
            <button type="button" class="mx-config-form-designer__mini-button is-danger" :aria-label="locale.t('reaction.removeEffect', 'Remove effect')" :disabled="disabled" @click="removeEffect(reactionIndex, branch, effectIndex)">
              <Trash2 :size="13" aria-hidden="true" />
            </button>
          </div>

          <div v-if="effect.kind === 'setValue'" class="mx-config-form-designer__reaction-operand">
            <ElSelect :model-value="effect.value.kind" :aria-label="locale.t('reaction.valueSource', 'Value source')" :disabled="disabled" @update:model-value="updateSetValueOperand(reactionIndex, branch, effectIndex, changeOperandSource(effect.value, $event as 'field' | 'literal'))">
              <ElOption value="literal" :label="locale.t('reaction.literal', 'Literal')" />
              <ElOption value="field" :label="locale.t('reaction.fieldValue', 'Field value')" />
              <ElOption v-if="effect.value.kind === 'expression'" value="expression" disabled :label="locale.t('reaction.expression', 'Expression')" />
            </ElSelect>
            <ElSelect v-if="effect.value.kind === 'field'" :model-value="effect.value.field" :aria-label="locale.t('reaction.sourceField', 'Source field')" :disabled="disabled" @update:model-value="updateSetValueOperand(reactionIndex, branch, effectIndex, updateOperandValue(effect.value, String($event)))">
              <ElOption v-for="field in fieldOptions" :key="field" :value="field" :label="field" />
            </ElSelect>
            <template v-else-if="effect.value.kind === 'literal'">
              <template v-if="literalKind(effect.value) !== 'complex'">
                <ElSelect :model-value="literalKind(effect.value)" :aria-label="locale.t('reaction.literalType', 'Literal type')" :disabled="disabled" @update:model-value="updateSetValueOperand(reactionIndex, branch, effectIndex, changeLiteralKind($event as LiteralKind))">
                  <ElOption value="text" :label="locale.t('valueType.text', 'Text')" />
                  <ElOption value="number" :label="locale.t('valueType.number', 'Number')" />
                  <ElOption value="boolean" :label="locale.t('valueType.boolean', 'Boolean')" />
                </ElSelect>
                <ElSelect v-if="literalKind(effect.value) === 'boolean'" :model-value="String(effect.value.value)" :disabled="disabled" @update:model-value="updateSetValueOperand(reactionIndex, branch, effectIndex, updateOperandValue(effect.value, $event === 'true'))">
                  <ElOption value="true" :label="locale.t('value.true', 'True')" />
                  <ElOption value="false" :label="locale.t('value.false', 'False')" />
                </ElSelect>
                <ElInputNumber v-else-if="literalKind(effect.value) === 'number'" :model-value="typeof effect.value.value === 'number' ? effect.value.value : 0" :disabled="disabled" controls-position="right" @change="updateSetValueOperand(reactionIndex, branch, effectIndex, updateOperandValue(effect.value, $event ?? 0))" />
                <ElInput v-else :model-value="typeof effect.value.value === 'string' ? effect.value.value : ''" :disabled="disabled" @update:model-value="updateSetValueOperand(reactionIndex, branch, effectIndex, updateOperandValue(effect.value, $event))" />
              </template>
              <output v-else>{{ locale.t('reaction.complexValue', 'Complex value preserved') }}</output>
            </template>
            <output v-else class="mx-config-form-designer__reaction-expression" :title="effect.value.expression">{{ effect.value.expression }}</output>
          </div>

          <div v-else-if="effect.kind === 'setState'" class="mx-config-form-designer__reaction-states">
            <label v-for="key in stateKeys" :key="key">
              <span>{{ locale.t(`condition.target.${key}`, key) }}</span>
              <ElSelect :model-value="stateValue(effect, key)" :disabled="disabled" @update:model-value="setStateValue(reactionIndex, branch, effectIndex, key, $event as 'off' | 'true' | 'false')">
                <ElOption value="off" :label="locale.t('condition.off', 'Off')" />
                <ElOption value="true" :label="locale.t('value.true', 'True')" />
                <ElOption value="false" :label="locale.t('value.false', 'False')" />
              </ElSelect>
            </label>
          </div>

          <div v-else-if="effect.kind === 'setProps'" class="mx-config-form-designer__reaction-props">
            <div v-for="(operand, key) in effect.props" :key="key" class="mx-config-form-designer__reaction-prop">
              <ElInput
                :model-value="keyDraft(`prop-${reactionIndex}-${branch}-${effectIndex}-${key}`, key)"
                :aria-label="locale.t('reaction.propName', 'Prop name')"
                :disabled="disabled"
                @update:model-value="updateKeyDraft(`prop-${reactionIndex}-${branch}-${effectIndex}-${key}`, $event)"
                @change="commitPropName(reactionIndex, branch, effectIndex, key, `prop-${reactionIndex}-${branch}-${effectIndex}-${key}`)"
              />
              <ElSelect :model-value="operand.kind" :disabled="disabled" @update:model-value="updatePropOperand(reactionIndex, branch, effectIndex, key, changeOperandSource(operand, $event as 'field' | 'literal'))">
                <ElOption value="literal" :label="locale.t('reaction.literal', 'Literal')" />
                <ElOption value="field" :label="locale.t('reaction.fieldValue', 'Field value')" />
                <ElOption v-if="operand.kind === 'expression'" value="expression" disabled :label="locale.t('reaction.expression', 'Expression')" />
              </ElSelect>
              <ElSelect v-if="operand.kind === 'field'" :model-value="operand.field" :disabled="disabled" @update:model-value="updatePropOperand(reactionIndex, branch, effectIndex, key, updateOperandValue(operand, String($event)))">
                <ElOption v-for="field in fieldOptions" :key="field" :value="field" :label="field" />
              </ElSelect>
              <template v-else-if="operand.kind === 'literal'">
                <template v-if="literalKind(operand) !== 'complex'">
                  <ElSelect :model-value="literalKind(operand)" :disabled="disabled" @update:model-value="updatePropOperand(reactionIndex, branch, effectIndex, key, changeLiteralKind($event as LiteralKind))">
                    <ElOption value="text" :label="locale.t('valueType.text', 'Text')" />
                    <ElOption value="number" :label="locale.t('valueType.number', 'Number')" />
                    <ElOption value="boolean" :label="locale.t('valueType.boolean', 'Boolean')" />
                  </ElSelect>
                  <ElSelect v-if="literalKind(operand) === 'boolean'" :model-value="String(operand.value)" :disabled="disabled" @update:model-value="updatePropOperand(reactionIndex, branch, effectIndex, key, updateOperandValue(operand, $event === 'true'))">
                    <ElOption value="true" :label="locale.t('value.true', 'True')" />
                    <ElOption value="false" :label="locale.t('value.false', 'False')" />
                  </ElSelect>
                  <ElInputNumber v-else-if="literalKind(operand) === 'number'" :model-value="typeof operand.value === 'number' ? operand.value : 0" :disabled="disabled" controls-position="right" @change="updatePropOperand(reactionIndex, branch, effectIndex, key, updateOperandValue(operand, $event ?? 0))" />
                  <ElInput v-else :model-value="typeof operand.value === 'string' ? operand.value : ''" :disabled="disabled" @update:model-value="updatePropOperand(reactionIndex, branch, effectIndex, key, updateOperandValue(operand, $event))" />
                </template>
                <output v-else>{{ locale.t('reaction.complexValue', 'Complex value preserved') }}</output>
              </template>
              <output v-else class="mx-config-form-designer__reaction-expression" :title="operand.expression">{{ operand.expression }}</output>
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
