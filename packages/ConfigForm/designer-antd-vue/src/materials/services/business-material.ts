import type {
  DesignerMaterialLocale,
  DesignerPropertySetterDefinition,
  DesignerSourceMaterialBinding,
} from '@moluoxixi/config-form-designer'
import type {
  MaterialDatasetBindingCapability,
  MaterialResourceBindingCapability,
  MaterialSemanticTrigger,
  ModelJsonObject,
} from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import { antdSource } from './source'

interface AntdBusinessMaterial {
  name: string
  order: number
  title: string
  category: string
  tag: string
  component: Component
  props: ModelJsonObject
  setters?: DesignerPropertySetterDefinition[]
  semanticTriggers?: MaterialSemanticTrigger[]
  datasetBindings?: MaterialDatasetBindingCapability[]
  resourceBindings?: MaterialResourceBindingCapability[]
  nativeSource?: boolean
  sourceRender?: DesignerSourceMaterialBinding['render']
  locale?: DesignerMaterialLocale
}

export function defineAntdBusinessMaterial(config: AntdBusinessMaterial) {
  return defineDesignerMaterialModule({
    name: config.name,
    order: config.order,
    value: {
      material: {
        key: `antd.${config.name}`,
        source: antdSource(config.name, config.tag, {
          ...(config.nativeSource ? { native: true } : {}),
          ...(config.sourceRender ? { render: config.sourceRender } : {}),
        }),
        version: 1,
        kind: 'element',
        title: config.title,
        category: config.category,
        runtime: { component: config.component },
        ...(config.semanticTriggers ? { semanticTriggers: config.semanticTriggers } : {}),
        ...(config.datasetBindings ? { datasetBindings: config.datasetBindings } : {}),
        ...(config.resourceBindings ? { resourceBindings: config.resourceBindings } : {}),
        setters: config.setters ?? [],
        createNode: ({ id }) => ({
          id,
          kind: 'element',
          component: `antd.${config.name}`,
          props: structuredClone(config.props),
        }),
      },
      locale: config.locale ?? { title: config.title, category: config.category },
    },
  })
}
