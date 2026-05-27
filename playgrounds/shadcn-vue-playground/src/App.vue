<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EditForm, ReadonlyForm } from '@/demos'

const activeDemo = shallowRef<'edit' | 'readonly'>('edit')

const activeComponent = computed(() => activeDemo.value === 'edit' ? EditForm : ReadonlyForm)
</script>

<template>
  <main class="playground-root">
    <aside class="playground-sidebar">
      <div class="playground-brand">
        <span class="playground-brand__eyebrow">ConfigForm</span>
        <h1 class="playground-brand__title">
          shadcn-vue
        </h1>
      </div>

      <nav class="playground-nav" aria-label="示例">
        <Button
          type="button"
          :variant="activeDemo === 'edit' ? 'default' : 'ghost'"
          class="playground-nav__button"
          @click="activeDemo = 'edit'"
        >
          编辑态
        </Button>
        <Button
          type="button"
          :variant="activeDemo === 'readonly' ? 'default' : 'ghost'"
          class="playground-nav__button"
          @click="activeDemo = 'readonly'"
        >
          只读态
        </Button>
      </nav>
    </aside>

    <section class="playground-main">
      <Card class="playground-intro">
        <CardHeader>
          <CardTitle>独立 playground</CardTitle>
          <CardDescription>
            验证 ConfigForm 通过 runtime plugin 接入 shadcn-vue 本地组件。
          </CardDescription>
        </CardHeader>
        <CardContent class="playground-intro__content">
          <code>component: 'Input'</code>
          <code>component: 'NativeSelect'</code>
          <code>component: 'Textarea'</code>
        </CardContent>
      </Card>

      <component :is="activeComponent" />
    </section>
  </main>
</template>
