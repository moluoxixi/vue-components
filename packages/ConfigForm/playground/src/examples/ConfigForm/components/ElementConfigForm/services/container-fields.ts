import type { ConfigFormNode } from '@moluoxixi/config-form-headless'
import type { ElementKnownValues } from '../types'
import { defineFields } from '@moluoxixi/config-form-headless'
import {
  ElCard,
  ElCollapse,
  ElCollapseItem,
  ElTabPane,
  ElTabs,
} from 'element-plus'
import { createElementKnownFields } from './known-fields'

const { defineField } = defineFields<ElementKnownValues>()

export const elementContainerFields: ConfigFormNode<ElementKnownValues>[] = [
  defineField({
    cellAttrs: {},
    component: ElCard,
    id: 'element-container-card',
    span: 24,
    props: { 'bodyClass': 'config-form-demo__container', 'class': 'config-form-demo__container-card', 'data-testid': 'element-container-node', 'header': 'Element Card 容器', 'shadow': 'never' },
    slots: { default: createElementKnownFields('element-container', false, defineField) },
  }),
  defineField({
    cellAttrs: {},
    component: ElCollapse,
    id: 'element-container-collapse',
    span: 24,
    props: { 'class': 'config-form-demo__container-collapse', 'data-testid': 'element-container-collapse-node', 'modelValue': ['profile'] },
    slots: {
      default: defineField({
        cellAttrs: {},
        component: ElCollapseItem,
        id: 'element-container-collapse-item',
        props: { name: 'profile', title: 'Element Collapse 容器' },
        slots: {
          default: defineField({
            cellAttrs: {},
            component: 'p',
            id: 'element-container-collapse-content',
            props: { textContent: 'Collapse 容器承载非字段配置节点' },
          }),
        },
      }),
    },
  }),
  defineField({
    cellAttrs: {},
    component: ElTabs,
    id: 'element-container-tabs',
    span: 24,
    props: { 'class': 'config-form-demo__container-tabs', 'data-testid': 'element-container-tabs-node', 'modelValue': 'base' },
    slots: {
      default: [
        defineField({
          cellAttrs: {},
          component: ElTabPane,
          id: 'element-container-tab-base',
          props: { label: '基础', name: 'base' },
          slots: { default: defineField({ cellAttrs: {}, component: 'p', id: 'element-container-tab-base-content', props: { textContent: 'Tabs 基础容器内容' } }) },
        }),
        defineField({
          cellAttrs: {},
          component: ElTabPane,
          id: 'element-container-tab-preference',
          props: { label: '偏好', name: 'preference' },
          slots: { default: defineField({ cellAttrs: {}, component: 'p', id: 'element-container-tab-preference-content', props: { textContent: 'Tabs 偏好容器内容' } }) },
        }),
      ],
    },
  }),
]
