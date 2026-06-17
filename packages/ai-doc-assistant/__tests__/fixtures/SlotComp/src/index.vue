<script setup lang="ts">
const cols = ['a', 'b']
</script>

<template>
  <div>
    <slot />
    <slot name="header" :title="'t'" />
    <template v-for="name in cols" #[name]="scope" :key="name">
      <slot :name="name" v-bind="scope" />
    </template>
  </div>
</template>
