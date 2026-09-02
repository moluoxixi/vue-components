<script setup lang="ts">
import type { AntdFlexLayoutProps } from '../types'
import { computed } from 'vue'

const props = withDefaults(defineProps<AntdFlexLayoutProps>(), {
  direction: 'row',
  wrap: true,
  gap: 12,
  justify: 'flex-start',
  align: 'stretch',
  itemWidth: 220,
})

const style = computed(() => ({
  '--mx-antd-flex-direction': props.direction,
  '--mx-antd-flex-wrap': props.wrap ? 'wrap' : 'nowrap',
  '--mx-antd-flex-gap': `${Math.max(0, props.gap)}px`,
  '--mx-antd-flex-justify': props.justify,
  '--mx-antd-flex-align': props.align,
  '--mx-antd-flex-item-width': `${Math.max(80, props.itemWidth)}px`,
}))
</script>

<template>
  <div class="mx-antd-flex-layout" :class="{ 'is-column': direction === 'column' }" :style="style">
    <slot />
  </div>
</template>
