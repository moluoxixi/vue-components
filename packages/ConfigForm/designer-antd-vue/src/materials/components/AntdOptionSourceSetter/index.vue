<script setup lang="ts">
import type { AntdOptionSourceSetterEmits, AntdOptionSourceSetterProps, AntdVueOptionSource } from '../../../types'
import { Select } from 'ant-design-vue'
import { useDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import { readAntdVueOptionSource, useAntdVueOptionResolverContext } from '../../../options'

const props = defineProps<AntdOptionSourceSetterProps>()

const emit = defineEmits<AntdOptionSourceSetterEmits>()

const context = useAntdVueOptionResolverContext()
const locale = useDesignerLocale()
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
    <div class="mx-config-form-designer__segmented" role="group" :aria-label="locale.t('optionSource.type', 'Option source type')">
      <button type="button" :class="{ 'is-active': kind === 'static' }" :aria-pressed="kind === 'static'" :disabled="disabled" @click="selectKind('static')">{{ locale.t('optionSource.static', 'Static') }}</button>
      <button type="button" :class="{ 'is-active': kind === 'dictionary' }" :aria-pressed="kind === 'dictionary'" :disabled="disabled || context.dictionaryKeys.length === 0" @click="selectKind('dictionary')">{{ locale.t('optionSource.dictionary', 'Dictionary') }}</button>
      <button type="button" :class="{ 'is-active': kind === 'provider' }" :aria-pressed="kind === 'provider'" :disabled="disabled || context.providerKeys.length === 0" @click="selectKind('provider')">{{ locale.t('optionSource.provider', 'Provider') }}</button>
    </div>
    <Select
      v-if="kind !== 'static'"
      :value="source && 'key' in source ? source.key : undefined"
      :options="keyOptions"
      :disabled="disabled"
      :aria-label="locale.t('optionSource.key', 'Option source key')"
      @update:value="selectKey"
    />
  </div>
</template>
