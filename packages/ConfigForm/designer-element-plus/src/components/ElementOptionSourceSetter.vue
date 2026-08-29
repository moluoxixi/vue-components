<script setup lang="ts">
import type { ElementPlusOptionSource } from '../options'
import { ElOption, ElSelect } from 'element-plus'
import { useDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import { readElementPlusOptionSource, useElementPlusOptionResolverContext } from '../options'

const props = defineProps<{
  modelValue?: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ElementPlusOptionSource | undefined]
}>()

const context = useElementPlusOptionResolverContext()
const locale = useDesignerLocale()
const source = computed(() => readElementPlusOptionSource(props.modelValue))
const kind = computed(() => source.value?.kind ?? 'static')
const keys = computed(() => kind.value === 'dictionary' ? context.dictionaryKeys : context.providerKeys)

function selectKind(nextKind: ElementPlusOptionSource['kind']): void {
  if (nextKind === 'static') {
    emit('update:modelValue', undefined)
    return
  }
  const sourceKeys = nextKind === 'dictionary' ? context.dictionaryKeys : context.providerKeys
  const key = sourceKeys[0]
  if (key)
    emit('update:modelValue', { kind: nextKind, key })
}

function selectKey(key: string): void {
  if (kind.value === 'dictionary' || kind.value === 'provider')
    emit('update:modelValue', { ...source.value, kind: kind.value, key })
}
</script>

<template>
  <div class="mx-element-designer-option-source">
    <div class="mx-config-form-designer__segmented" role="group" :aria-label="locale.t('optionSource.type', 'Option source type')">
      <button type="button" :class="{ 'is-active': kind === 'static' }" :aria-pressed="kind === 'static'" :disabled="disabled" @click="selectKind('static')">{{ locale.t('optionSource.static', 'Static') }}</button>
      <button type="button" :class="{ 'is-active': kind === 'dictionary' }" :aria-pressed="kind === 'dictionary'" :disabled="disabled || context.dictionaryKeys.length === 0" @click="selectKind('dictionary')">{{ locale.t('optionSource.dictionary', 'Dictionary') }}</button>
      <button type="button" :class="{ 'is-active': kind === 'provider' }" :aria-pressed="kind === 'provider'" :disabled="disabled || context.providerKeys.length === 0" @click="selectKind('provider')">{{ locale.t('optionSource.provider', 'Provider') }}</button>
    </div>
    <ElSelect
      v-if="kind !== 'static'"
      :model-value="source && 'key' in source ? source.key : undefined"
      :disabled="disabled"
      :aria-label="locale.t('optionSource.key', 'Option source key')"
      @update:model-value="selectKey"
    >
      <ElOption v-for="key in keys" :key="key" :label="key" :value="key" />
    </ElSelect>
  </div>
</template>
