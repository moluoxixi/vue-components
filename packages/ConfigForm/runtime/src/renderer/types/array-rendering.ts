import type { ConfigFormComponentNode, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type { ConfigFormRendererCellAttrs, ConfigFormRendererFieldAttrs } from './contracts'

/**
 * 声明了 `valueScope` 的容器节点在行渲染管线中的形状。
 * 行渲染只消费组件节点的公共结构（valueScope / props / slots），不引入额外约束。
 */
export type RuntimeArrayComponentNode<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormComponentNode<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  >
