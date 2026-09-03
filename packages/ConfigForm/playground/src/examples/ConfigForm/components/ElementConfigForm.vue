<script setup lang="ts">
import { ElTabPane, ElTabs } from 'element-plus'
import { shallowRef } from 'vue'
import {
  ElementContainerScenario,
  ElementLayoutScenario,
  ElementLinkedScenario,
} from './ElementConfigForm/components'
import './ElementConfigForm/style'

type ScenarioTab = 'layout' | 'container' | 'linked'

const activeTab = shallowRef<ScenarioTab>('layout')
</script>

<template>
  <div class="config-form-demo" data-testid="element-config-form-example">
    <ElTabs v-model="activeTab" data-testid="element-scenario-tabs">
      <ElTabPane label="布局" name="layout">
        <ElementLayoutScenario />
      </ElTabPane>
      <ElTabPane label="容器" name="container">
        <ElementContainerScenario />
      </ElTabPane>
      <ElTabPane label="联动" name="linked">
        <ElementLinkedScenario />
      </ElTabPane>
    </ElTabs>
  </div>
</template>
