<script setup lang="ts">
import type {
  ConfigFormReaction,
  ConfigFormReactionBranch,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
  ConfigFormReactionStateKey,
} from '@moluoxixi/config-form-core'
import type { ReactionEditorEmits, ReactionEditorProps } from './types'
import { Plus, Trash2 } from '@lucide/vue'
import { ConditionEditor } from '../ConditionEditor'
import { OperandEditor } from '../OperandEditor'
import { cloneWorkbenchJson as structuredClone } from '../../../../../../utils'

const props = withDefaults(defineProps<ReactionEditorProps>(), { disabled: false })
const emit = defineEmits<ReactionEditorEmits>()
const branches: ConfigFormReactionBranch[] = ['then', 'else']
const effectKinds: ConfigFormReactionEffect['kind'][] = ['setValue', 'clearValue', 'setState', 'setProps', 'validate']
const stateKeys: ConfigFormReactionStateKey[] = ['visible', 'disabled', 'readonly', 'required']

function update(reactions: ConfigFormReaction[]): void {
  if (!props.disabled)
    emit('update:modelValue', reactions)
}

function addReaction(): void {
  const target = props.fields[0]?.field
  if (!target)
    return
  const ids = new Set(props.modelValue.map(reaction => reaction.id))
  let index = props.modelValue.length + 1
  while (ids.has(`reaction-${index}`))
    index += 1
  update([...props.modelValue, {
    id: `reaction-${index}`,
    enabled: true,
    when: { kind: 'literal', value: true },
    then: [{ kind: 'setValue', target, value: { kind: 'literal', value: '' } }],
  }])
}

function replaceReaction(index: number, reaction: ConfigFormReaction): void {
  update(props.modelValue.map((item, itemIndex) => itemIndex === index ? reaction : structuredClone(item)))
}

function removeReaction(index: number): void {
  update(props.modelValue.filter((_, itemIndex) => itemIndex !== index).map(item => structuredClone(item)))
}

function effects(reaction: ConfigFormReaction, branch: ConfigFormReactionBranch): readonly ConfigFormReactionEffect[] {
  return branch === 'then' ? reaction.then : reaction.else ?? []
}

function updateEffects(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  nextEffects: ConfigFormReactionEffect[],
): void {
  const reaction = structuredClone(props.modelValue[reactionIndex]!)
  if (branch === 'then')
    reaction.then = nextEffects
  else if (nextEffects.length > 0)
    reaction.else = nextEffects
  else
    delete reaction.else
  replaceReaction(reactionIndex, reaction)
}

function addEffect(reactionIndex: number, branch: ConfigFormReactionBranch): void {
  const target = props.fields[0]?.field
  if (!target)
    return
  const reaction = props.modelValue[reactionIndex]!
  updateEffects(reactionIndex, branch, [...effects(reaction, branch), {
    kind: 'setValue',
    target,
    value: { kind: 'literal', value: '' },
  }])
}

function replaceEffect(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  effectIndex: number,
  effect: ConfigFormReactionEffect,
): void {
  const next = effects(props.modelValue[reactionIndex]!, branch).map((item, index) => index === effectIndex ? effect : structuredClone(item))
  updateEffects(reactionIndex, branch, next)
}

function removeEffect(reactionIndex: number, branch: ConfigFormReactionBranch, effectIndex: number): void {
  updateEffects(
    reactionIndex,
    branch,
    effects(props.modelValue[reactionIndex]!, branch)
      .filter((_, index) => index !== effectIndex)
      .map(item => structuredClone(item)),
  )
}

function createEffect(kind: ConfigFormReactionEffect['kind'], target: string): ConfigFormReactionEffect {
  if (kind === 'setValue')
    return { kind, target, value: { kind: 'literal', value: '' } }
  if (kind === 'setState')
    return { kind, target, state: { visible: true } }
  if (kind === 'setProps')
    return { kind, target, props: {} }
  return { kind, target }
}

function changeEffectKind(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  effectIndex: number,
  kind: ConfigFormReactionEffect['kind'],
): void {
  const current = effects(props.modelValue[reactionIndex]!, branch)[effectIndex]!
  replaceEffect(reactionIndex, branch, effectIndex, createEffect(kind, current.target))
}

function changeTarget(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  effectIndex: number,
  target: string,
): void {
  const current = effects(props.modelValue[reactionIndex]!, branch)[effectIndex]!
  replaceEffect(reactionIndex, branch, effectIndex, { ...current, target })
}

function updateSetValue(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  effectIndex: number,
  value: ConfigFormReactionOperand,
): void {
  const current = effects(props.modelValue[reactionIndex]!, branch)[effectIndex]
  if (current?.kind === 'setValue')
    replaceEffect(reactionIndex, branch, effectIndex, { ...current, value })
}

function stateValue(effect: Extract<ConfigFormReactionEffect, { kind: 'setState' }>, key: ConfigFormReactionStateKey): string {
  return effect.state[key] === undefined ? 'off' : String(effect.state[key])
}

function updateState(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  effectIndex: number,
  key: ConfigFormReactionStateKey,
  value: 'off' | 'true' | 'false',
): void {
  const current = effects(props.modelValue[reactionIndex]!, branch)[effectIndex]
  if (current?.kind !== 'setState')
    return
  const state = { ...current.state }
  if (value === 'off')
    delete state[key]
  else
    state[key] = value === 'true'
  replaceEffect(reactionIndex, branch, effectIndex, { ...current, state })
}

function addProp(reactionIndex: number, branch: ConfigFormReactionBranch, effectIndex: number): void {
  const current = effects(props.modelValue[reactionIndex]!, branch)[effectIndex]
  if (current?.kind !== 'setProps')
    return
  let index = Object.keys(current.props).length + 1
  while (Object.hasOwn(current.props, `prop${index}`))
    index += 1
  replaceEffect(reactionIndex, branch, effectIndex, {
    ...current,
    props: { ...current.props, [`prop${index}`]: { kind: 'literal', value: '' } },
  })
}

function renameProp(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  effectIndex: number,
  previous: string,
  nextValue: unknown,
): void {
  const current = effects(props.modelValue[reactionIndex]!, branch)[effectIndex]
  const next = String(nextValue).trim()
  if (current?.kind !== 'setProps' || !isSafeKey(next) || (next !== previous && Object.hasOwn(current.props, next)))
    return
  const entries: Record<string, ConfigFormReactionOperand> = {}
  Object.entries(current.props).forEach(([key, value]) => {
    entries[key === previous ? next : key] = value
  })
  replaceEffect(reactionIndex, branch, effectIndex, { ...current, props: entries })
}

function updateProp(
  reactionIndex: number,
  branch: ConfigFormReactionBranch,
  effectIndex: number,
  key: string,
  value: ConfigFormReactionOperand | undefined,
): void {
  const current = effects(props.modelValue[reactionIndex]!, branch)[effectIndex]
  if (current?.kind !== 'setProps')
    return
  const next = { ...current.props }
  if (value)
    next[key] = value
  else
    delete next[key]
  replaceEffect(reactionIndex, branch, effectIndex, { ...current, props: next })
}

function effectLabel(kind: ConfigFormReactionEffect['kind']): string {
  const fallbacks: Record<ConfigFormReactionEffect['kind'], string> = {
    setValue: 'Assign value',
    clearValue: 'Clear value',
    setState: 'Set field state',
    setProps: 'Set component properties',
    validate: 'Validate field',
  }
  return props.locale.t(`flow.reaction.effect.${kind}`, fallbacks[kind])
}

function isSafeKey(value: string): boolean {
  return !!value && !['__proto__', 'prototype', 'constructor'].includes(value)
}
</script>

<template>
  <div class="flow-reaction-editor">
    <article v-for="(reaction, reactionIndex) in modelValue" :key="reaction.id" class="flow-reaction-rule">
      <header>
        <strong>{{ locale.t('flow.reaction.rule', 'Rule {index}', { index: reactionIndex + 1 }) }}</strong>
        <ElSwitch
          :model-value="reaction.enabled !== false"
          :disabled="disabled"
          :aria-label="locale.t('flow.reaction.enabled', 'Rule enabled')"
          @change="replaceReaction(reactionIndex, { ...reaction, enabled: Boolean($event) })"
        />
        <ElButton text :disabled="disabled" :title="locale.t('flow.reaction.remove', 'Remove rule')" :aria-label="locale.t('flow.reaction.remove', 'Remove rule')" @click="removeReaction(reactionIndex)">
          <Trash2 :size="14" aria-hidden="true" />
        </ElButton>
      </header>

      <div class="flow-reaction-condition">
        <span>{{ locale.t('flow.reaction.when', 'When') }}</span>
        <ConditionEditor
          :model-value="reaction.when"
          :disabled="disabled"
          :fields="fields"
          :event-arguments="eventArguments"
          :outputs="outputs"
          :locale="locale"
          @update:model-value="replaceReaction(reactionIndex, { ...reaction, when: $event })"
        />
      </div>

      <section v-for="branch in branches" :key="branch" class="flow-reaction-branch">
        <strong>{{ branch === 'then' ? locale.t('flow.branch.then', 'Then') : locale.t('flow.branch.else', 'Otherwise') }}</strong>
        <div v-for="(effect, effectIndex) in effects(reaction, branch)" :key="effectIndex" class="flow-reaction-effect">
          <div class="flow-reaction-effect-heading">
            <ElSelect :model-value="effect.kind" :disabled="disabled" :aria-label="locale.t('flow.reaction.effect', 'Update type')" append-to="#workbench-overlays" @change="changeEffectKind(reactionIndex, branch, effectIndex, $event)">
              <ElOption v-for="kind in effectKinds" :key="kind" :value="kind" :label="effectLabel(kind)" />
            </ElSelect>
            <ElSelect :model-value="effect.target" :disabled="disabled" filterable :aria-label="locale.t('flow.reaction.target', 'Target field')" append-to="#workbench-overlays" @change="changeTarget(reactionIndex, branch, effectIndex, $event)">
              <ElOption v-if="!fields.some(field => field.field === effect.target)" :value="effect.target" :label="locale.t('flow.source.unavailableField', 'Unavailable field')" />
              <ElOption v-for="field in fields" :key="field.nodeId" :value="field.field" :label="field.label" />
            </ElSelect>
            <ElButton text :disabled="disabled" :title="locale.t('flow.reaction.removeEffect', 'Remove update')" :aria-label="locale.t('flow.reaction.removeEffect', 'Remove update')" @click="removeEffect(reactionIndex, branch, effectIndex)">
              <Trash2 :size="13" aria-hidden="true" />
            </ElButton>
          </div>

          <OperandEditor
            v-if="effect.kind === 'setValue'"
            :model-value="effect.value"
            :disabled="disabled"
            :fields="fields"
            :event-arguments="eventArguments"
            :outputs="outputs"
            :locale="locale"
            @update:model-value="updateSetValue(reactionIndex, branch, effectIndex, $event)"
          />

          <div v-else-if="effect.kind === 'setState'" class="flow-state-grid">
            <label v-for="key in stateKeys" :key="key">
              <span>{{ locale.t(`condition.target.${key}`, key) }}</span>
              <ElSelect :model-value="stateValue(effect, key)" :disabled="disabled" append-to="#workbench-overlays" @change="updateState(reactionIndex, branch, effectIndex, key, $event)">
                <ElOption value="off" :label="locale.t('condition.off', 'Unchanged')" />
                <ElOption value="true" :label="locale.t('value.true', 'Yes')" />
                <ElOption value="false" :label="locale.t('value.false', 'No')" />
              </ElSelect>
            </label>
          </div>

          <div v-else-if="effect.kind === 'setProps'" class="flow-prop-list">
            <div v-for="(operand, key) in effect.props" :key="key" class="flow-prop-row">
              <ElInput :model-value="key" :disabled="disabled" :aria-label="locale.t('flow.reaction.propName', 'Property name')" @change="renameProp(reactionIndex, branch, effectIndex, key, $event)" />
              <OperandEditor
                :model-value="operand"
                :disabled="disabled"
                :fields="fields"
                :event-arguments="eventArguments"
                :outputs="outputs"
                :locale="locale"
                @update:model-value="updateProp(reactionIndex, branch, effectIndex, key, $event)"
              />
              <ElButton text :disabled="disabled" :title="locale.t('flow.reaction.removeProp', 'Remove property')" :aria-label="locale.t('flow.reaction.removeProp', 'Remove property')" @click="updateProp(reactionIndex, branch, effectIndex, key, undefined)"><Trash2 :size="13" /></ElButton>
            </div>
            <ElButton :disabled="disabled" @click="addProp(reactionIndex, branch, effectIndex)"><Plus :size="13" />{{ locale.t('flow.reaction.addProp', 'Add property') }}</ElButton>
          </div>
        </div>
        <ElButton :disabled="disabled || fields.length === 0" @click="addEffect(reactionIndex, branch)">
          <Plus :size="13" aria-hidden="true" />
          {{ locale.t('flow.reaction.addEffect', 'Add update') }}
        </ElButton>
      </section>
    </article>

    <ElButton data-testid="add-reaction-rule" :disabled="disabled || fields.length === 0" @click="addReaction">
      <Plus :size="14" aria-hidden="true" />
      {{ locale.t('flow.reaction.add', 'Add rule') }}
    </ElButton>
  </div>
</template>

<style scoped>
.flow-reaction-editor { display: grid; min-width: 0; gap: 12px; }
.flow-reaction-rule { display: grid; min-width: 0; gap: 10px; padding: 10px; border: 1px solid var(--wb-separator); border-radius: 6px; background: var(--wb-bg); }
.flow-reaction-rule > header { display: grid; grid-template-columns: minmax(0, 1fr) auto 28px; align-items: center; gap: 7px; }
.flow-reaction-rule > header strong { font-size: 11px; }
.flow-reaction-rule > header .el-button { width: 28px; min-height: 28px; padding: 0; }
.flow-reaction-condition, .flow-reaction-branch { display: grid; min-width: 0; gap: 7px; }
.flow-reaction-condition > span, .flow-reaction-branch > strong { color: var(--wb-muted); font-size: 10px; text-transform: uppercase; }
.flow-reaction-branch { padding-top: 8px; border-top: 1px solid var(--wb-separator); }
.flow-reaction-effect { display: grid; min-width: 0; gap: 7px; padding-left: 8px; border-left: 2px solid var(--wb-control-border); }
.flow-reaction-effect-heading { display: grid; grid-template-columns: minmax(110px, 1fr) minmax(110px, 1fr) 28px; gap: 6px; }
.flow-reaction-effect-heading .el-button { width: 28px; min-height: 28px; padding: 0; }
.flow-state-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.flow-state-grid label { display: grid; gap: 4px; }
.flow-state-grid label span { color: var(--wb-muted); font-size: 10px; }
.flow-prop-list { display: grid; min-width: 0; gap: 7px; }
.flow-prop-row { display: grid; min-width: 0; grid-template-columns: minmax(80px, .5fr) minmax(180px, 1.5fr) 28px; gap: 6px; }
.flow-prop-row > .el-button { width: 28px; min-height: 28px; padding: 0; }
@media (max-width: 620px) {
  .flow-reaction-effect-heading, .flow-prop-row { grid-template-columns: minmax(0, 1fr) 28px; }
  .flow-reaction-effect-heading > :nth-child(2), .flow-prop-row > :nth-child(2) { grid-column: 1; }
  .flow-reaction-effect-heading > .el-button, .flow-prop-row > .el-button { grid-column: 2; grid-row: 1; }
}
</style>
