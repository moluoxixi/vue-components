<script setup lang="ts">
import { ref } from 'vue'
import { useLockScreen } from '../composables/lock-screen'
import VPFullScreenMenu from './full-screen/vp-menu.vue'

const props = defineProps<{
  fullScreen: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { lock, cleanup } = useLockScreen()
const fullscreen = ref()
</script>

<template>
  <Transition name="el-fade-in" @enter="lock" @after-leave="cleanup">
    <div v-if="props.fullScreen" id="full-screen" ref="fullscreen">
      <div class="full-screen-container">
        <VPFullScreenMenu @close="emit('close')" />
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.full-screen {
  position: fixed;
  top: var(--ep-docs-nav-height);
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0 32px;
  width: 100%;
  background-color: var(--ep-docs-bg-color);
  transition: background-color 0.5s;
  overflow-y: auto;

  &.epd-fade-in-enter-active,
  &.epd-fade-in-leave-active {
    .full-screen-container {
      transition: transform var(--epd-transition-duration)
        var(--epd-transition-function-ease-in-out-bezier);
    }
  }

  &.epd-fade-in-enter-from,
  &.epd-fade-in-leave-to {
    .full-screen-container {
      transform: translateY(-8px);
    }
  }

  .full-screen-container {
    margin: 0 auto;
    padding: 24px 0 96px;
    max-width: 18rem;
  }
}
</style>
