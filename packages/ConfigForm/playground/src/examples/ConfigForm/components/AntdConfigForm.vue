<script setup lang="ts">
import { TabPane as ATabPane, Tabs as ATabs } from 'ant-design-vue'
import { shallowRef } from 'vue'
import {
  AntdContainerScenario,
  AntdLayoutScenario,
  AntdLinkedScenario,
} from './AntdConfigForm/components'
import './AntdConfigForm/style'

type ScenarioTab = 'layout' | 'container' | 'linked'

const activeTab = shallowRef<ScenarioTab>('layout')
</script>

<template>
  <div class="config-form-demo" data-testid="antd-config-form-example">
    <ATabs v-model:active-key="activeTab" data-testid="antd-scenario-tabs">
      <ATabPane key="layout" tab="布局">
        <AntdLayoutScenario />
      </ATabPane>
      <ATabPane key="container" tab="容器">
        <AntdContainerScenario />
      </ATabPane>
      <ATabPane key="linked" tab="联动">
        <AntdLinkedScenario />
      </ATabPane>
    </ATabs>
  </div>
</template>
