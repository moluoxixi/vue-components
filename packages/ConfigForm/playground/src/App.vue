<script setup lang="ts">
import type { Component } from 'vue'
import { computed, shallowRef } from 'vue'

interface ExampleMeta {
  name: string
  title: string
  category: string
  description: string
  hidden?: boolean
  order: number
}

interface ExampleModule {
  default: Component
  exampleMeta: ExampleMeta
}

interface ExampleItem extends ExampleMeta {
  component: Component
}

const exampleModules = import.meta.glob<ExampleModule>([
  './examples/*.vue',
  './examples/*/index.vue',
], { eager: true })

const examples = Object
  .values(exampleModules)
  .filter(module => !module.exampleMeta.hidden)
  .map((module): ExampleItem => ({
    ...module.exampleMeta,
    component: module.default,
  }))
  .sort((current, next) => current.order - next.order)

const activeExampleName = shallowRef(examples[0].name)

const activeExample = computed<ExampleItem>(() => {
  return examples.find(example => example.name === activeExampleName.value)!
})
</script>

<template>
  <main class="config-form-playground-root">
    <component :is="activeExample.component" />
  </main>
</template>

<style scoped lang="scss">
.config-form-playground-root {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24px;
  background: #fff;
  font-family: system-ui, sans-serif;
}
</style>
