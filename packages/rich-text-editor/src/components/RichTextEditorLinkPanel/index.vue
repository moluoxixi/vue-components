<script setup lang="ts">
import { Check, Link2, Unlink, X } from '@lucide/vue'

const props = defineProps<{
  apply: () => void
  close: () => void
  setInputRef: (element: unknown) => void
  isLinkActive: boolean
  linkHref: string
  remove: () => void
}>()

const emit = defineEmits<{ 'update:linkHref': [value: string] }>()
</script>

<template>
  <form class="mx-rich-text-editor__link-panel" @submit.prevent="props.apply">
    <Link2 :size="16" aria-hidden="true" />
    <input
      :ref="props.setInputRef"
      :value="props.linkHref"
      class="mx-rich-text-editor__link-input"
      type="text"
      inputmode="url"
      autocomplete="url"
      aria-label="链接地址"
      placeholder="https://example.com"
      @input="emit('update:linkHref', ($event.target as HTMLInputElement).value)"
      @keydown.esc.prevent="props.close"
    >
    <button class="mx-rich-text-editor__tool" type="submit" title="应用链接" aria-label="应用链接"><Check :size="17" aria-hidden="true" /></button>
    <button v-if="props.isLinkActive" class="mx-rich-text-editor__tool" type="button" title="移除链接" aria-label="移除链接" @click="props.remove"><Unlink :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" type="button" title="关闭" aria-label="关闭链接编辑" @click="props.close"><X :size="17" aria-hidden="true" /></button>
  </form>
</template>
