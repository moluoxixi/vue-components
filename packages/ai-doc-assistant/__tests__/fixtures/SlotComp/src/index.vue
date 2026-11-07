<script setup lang="ts">
const cols = ['a', 'b']
</script>

<template>
  <div>
    <slot />
    <slot name="header" title="t" />
    <!-- eslint-disable-next-line vue/valid-v-slot -- Parser fixture deliberately exercises dynamic slot declarations. -->
    <template v-for="name in cols" #[name]="scope" :key="name">
      <slot :name="name" v-bind="scope" />
    </template>
  </div>
</template>
