<script setup lang="ts">
defineProps<{ reason?: string, label?: string }>()
</script>

<template>
  <ElTooltip
    :content="reason || label || ''"
    :disabled="!reason && !label"
    effect="light"
    transition="none"
    :trigger="['hover', 'focus']"
    :trigger-keys="[]"
    :show-after="250"
    :hide-after="0"
    :enterable="false"
    :persistent="false"
    append-to="#workbench-overlays"
    popper-class="workbench-passive-tooltip"
  >
    <span class="control-hint" :class="{ 'has-disabled-reason': reason }" :tabindex="reason ? 0 : undefined" :aria-label="reason">
      <slot />
    </span>
  </ElTooltip>
</template>

<style scoped>
.control-hint {
  display: inline-flex;
  min-width: 0;
  vertical-align: middle;
}
.control-hint:focus-visible {
  outline: 2px solid var(--wb-focus);
  outline-offset: 2px;
  border-radius: 4px;
}
.has-disabled-reason :deep(:disabled) {
  pointer-events: none;
}
</style>
