<script setup lang="ts">
import { Check, Link2, Unlink, X } from '@lucide/vue'
import { onMounted, useId, useTemplateRef } from 'vue'

defineProps<{ error: string, isLinkActive: boolean }>()
const linkHref = defineModel<string>('linkHref', { required: true })
const emit = defineEmits<{ apply: [], close: [], remove: [] }>()
const input = useTemplateRef<HTMLInputElement>('input')
const errorId = useId()
onMounted(() => {
  input.value?.focus()
  input.value?.select()
})
</script>

<template>
  <div class="mx-rich-text-editor__link-panel" role="group" aria-label="编辑链接" @keydown.esc.stop.prevent="emit('close')">
    <Link2 :size="16" aria-hidden="true" />
    <input
      ref="input"
      v-model="linkHref"
      class="mx-rich-text-editor__link-input"
      type="text"
      inputmode="url"
      autocomplete="url"
      aria-label="链接地址"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
      placeholder="https://example.com"
      @keydown.enter.stop.prevent="!$event.isComposing && emit('apply')"
    >
    <button class="mx-rich-text-editor__tool" type="button" title="应用链接" aria-label="应用链接" @click="emit('apply')"><Check :size="17" aria-hidden="true" /></button>
    <button v-if="isLinkActive" class="mx-rich-text-editor__tool" type="button" title="移除链接" aria-label="移除链接" @click="emit('remove')"><Unlink :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" type="button" title="关闭" aria-label="关闭链接编辑" @click="emit('close')"><X :size="17" aria-hidden="true" /></button>
    <p v-if="error" :id="errorId" class="mx-rich-text-editor__link-error" role="alert">{{ error }}</p>
  </div>
</template>
