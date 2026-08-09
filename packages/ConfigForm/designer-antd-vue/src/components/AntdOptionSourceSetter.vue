<script setup lang="ts">
import type { AntdVueOptionSource } from '../options'
import { Select } from 'ant-design-vue'
import { computed } from 'vue'
import { readAntdVueOptionSource, useAntdVueOptionResolverContext } from '../options'

const props = defineProps<{
  modelValue?: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AntdVueOptionSource | undefined]
}>()

const context = useAntdVueOptionResolverContext()
const source = computed(() => readAntdVueOptionSource(props.modelValue))
const kind = computed(() => source.value?.kind ?? 'static')
const keys = computed(() => kind.value === 'dictionary' ? context.dictionaryKeys : context.providerKeys)
const keyOptions = computed(() => keys.value.map(key => ({ label: key, value: key })))

function selectKind(nextKind: AntdVueOptionSource['kind']): void {
  if (nextKind === 'static') {
    emit('update:modelValue', undefined)
    return
  }
  const sourceKeys = nextKind === 'dictionary' ? context.dictionaryKeys : context.providerKeys
  const key = sourceKeys[0]
  if (key)
    emit('update:modelValue', { kind: nextKind, key })
}

function selectKey(key: unknown): void {
  if (typeof key === 'string' && (kind.value === 'dictionary' || kind.value === 'provider'))
    emit('update:modelValue', { ...source.value, kind: kind.value, key })
}
</script>

<template>
  <div class="mx-antd-designer-option-source">
    <div class="mx-config-form-designer__segmented" role="group" aria-label="Option source type">
      <button type="button" :class="{ 'is-active': kind === 'static' }" :aria-pressed="kind === 'static'" :disabled="disabled" @click="selectKind('static')">Static</button>
      <button type="button" :class="{ 'is-active': kind === 'dictionary' }" :aria-pressed="kind === 'dictionary'" :disabled="disabled || context.dictionaryKeys.length === 0" @click="selectKind('dictionary')">Dictionary</button>
      <button type="button" :class="{ 'is-active': kind === 'provider' }" :aria-pressed="kind === 'provider'" :disabled="disabled || context.providerKeys.length === 0" @click="selectKind('provider')">Provider</button>
    </div>
    <Select
      v-if="kind !== 'static'"
      :value="source && 'key' in source ? source.key : undefined"
      :options="keyOptions"
      :disabled="disabled"
      aria-label="Option source key"
      @update:value="selectKey"
    />
  </div>
</template>
