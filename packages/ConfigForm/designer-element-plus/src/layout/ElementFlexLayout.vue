<script setup lang="ts">
import { computed } from 'vue'

type FlexDirection = 'row' | 'column'
type FlexJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between'
type FlexAlign = 'flex-start' | 'center' | 'flex-end' | 'stretch'

const props = withDefaults(defineProps<{
  direction?: FlexDirection
  wrap?: boolean
  gap?: number
  justify?: FlexJustify
  align?: FlexAlign
  itemWidth?: number
}>(), {
  direction: 'row',
  wrap: true,
  gap: 12,
  justify: 'flex-start',
  align: 'stretch',
  itemWidth: 220,
})

const style = computed(() => ({
  '--mx-element-flex-direction': props.direction,
  '--mx-element-flex-wrap': props.wrap ? 'wrap' : 'nowrap',
  '--mx-element-flex-gap': `${Math.max(0, props.gap)}px`,
  '--mx-element-flex-justify': props.justify,
  '--mx-element-flex-align': props.align,
  '--mx-element-flex-item-width': `${Math.max(80, props.itemWidth)}px`,
}))
</script>

<template>
  <div class="mx-element-flex-layout" :class="{ 'is-column': direction === 'column' }" :style="style">
    <slot />
  </div>
</template>
