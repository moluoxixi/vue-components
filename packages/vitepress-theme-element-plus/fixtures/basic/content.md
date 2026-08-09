---
title: Reusable content modules
---

# Reusable content modules

This page is wired entirely through the theme package public API.

## Demo

:::demo Fixture counter
```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <button data-testid="fixture-demo-button" type="button" @click="count += 1">
    Fixture count: {{ count }}
  </button>
</template>
```
:::

## API

<ApiDocs name="FixtureButton" />
