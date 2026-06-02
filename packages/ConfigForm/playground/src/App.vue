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

interface ExampleGroup {
  category: string
  examples: ExampleItem[]
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

const exampleGroups = computed<ExampleGroup[]>(() => {
  const groups = new Map<string, ExampleItem[]>()

  examples.forEach((example) => {
    const groupExamples = groups.get(example.category)

    if (groupExamples) {
      groupExamples.push(example)
      return
    }

    groups.set(example.category, [example])
  })

  return Array.from(groups, ([category, groupExamples]) => ({
    category,
    examples: groupExamples,
  }))
})

const activeExample = computed<ExampleItem>(() => {
  return examples.find(example => example.name === activeExampleName.value)!
})
</script>

<template>
  <ElContainer class="config-form-playground">
    <ElAside class="config-form-playground__sidebar" width="248px">
      <div class="config-form-playground__brand">
        <div class="config-form-playground__title">
          ConfigForm
        </div>
        <div class="config-form-playground__subtitle">
          Playground
        </div>
      </div>

      <ElMenu
        class="config-form-playground__menu"
        :default-openeds="exampleGroups.map(group => group.category)"
        :default-active="activeExampleName"
        @select="activeExampleName = $event"
      >
        <ElSubMenu
          v-for="group in exampleGroups"
          :key="group.category"
          :index="group.category"
        >
          <template #title>
            <span>{{ group.category }}</span>
          </template>
          <ElMenuItem
            v-for="example in group.examples"
            :key="example.name"
            :index="example.name"
          >
            {{ example.title }}
          </ElMenuItem>
        </ElSubMenu>
      </ElMenu>
    </ElAside>

    <ElMain class="config-form-playground__main">
      <header class="config-form-playground__header">
        <div>
          <h1 class="config-form-playground__heading">
            {{ activeExample.title }}
          </h1>
          <p class="config-form-playground__description">
            {{ activeExample.description }}
          </p>
        </div>
      </header>

      <section class="config-form-playground__stage">
        <component :is="activeExample.component" />
      </section>
    </ElMain>
  </ElContainer>
</template>

<style scoped lang="scss">
.config-form-playground {
  min-height: 100vh;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}

.config-form-playground__sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.config-form-playground__brand {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.config-form-playground__title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
}

.config-form-playground__subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.config-form-playground__menu {
  border-right: 0;
}

.config-form-playground__main {
  min-width: 0;
  padding: 28px;
}

.config-form-playground__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  max-width: 1120px;
  margin: 0 auto 20px;
}

.config-form-playground__heading {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}

.config-form-playground__description {
  max-width: 760px;
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.config-form-playground__stage {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
}

@media (max-width: 780px) {
  .config-form-playground {
    display: block;
  }

  .config-form-playground__sidebar {
    position: relative;
    width: 100% !important;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-light);
  }

  .config-form-playground__main {
    padding: 18px;
  }

  .config-form-playground__stage {
    padding: 16px;
  }
}
</style>
