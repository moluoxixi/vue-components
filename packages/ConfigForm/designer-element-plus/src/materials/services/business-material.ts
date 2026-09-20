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
import { elementSource } from './source'

interface ElementBusinessMaterial {
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

export function defineElementBusinessMaterial(config: ElementBusinessMaterial) {
  return defineDesignerMaterialModule({
    name: config.name,
    order: config.order,
    value: {
      material: {
        key: `element.${config.name}`,
        source: elementSource(config.name, config.tag, {
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
          component: `element.${config.name}`,
          props: structuredClone(config.props),
        }),
      },
      locale: config.locale ?? { title: config.title, category: config.category },
    },
  })
}
