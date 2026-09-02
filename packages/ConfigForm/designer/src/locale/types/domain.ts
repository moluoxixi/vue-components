import type { DesignerJsonValue } from '../../graph'
import type { DesignerMaterialDefinition } from '../../registry'

export interface DesignerMaterialLocale {
  title?: string
  category?: string
  setters?: Record<string, string>
  options?: Record<string, Record<string, string>>
  slots?: Record<string, string>
}

export interface DesignerLocaleOptions {
  locale?: string
  messages?: Record<string, string>
  materials?: Record<string, DesignerMaterialLocale>
  translate?: (key: string, fallback: string, params?: Record<string, unknown>) => string
}

export interface DesignerLocale {
  locale: string
  t: (key: string, fallback: string, params?: Record<string, unknown>) => string
  materialTitle: (material: DesignerMaterialDefinition) => string
  materialCategory: (material: DesignerMaterialDefinition) => string
  materialSetterLabel: (material: DesignerMaterialDefinition, setterKey: string, fallback: string) => string
  materialSetterOptionLabel: (material: DesignerMaterialDefinition, setterKey: string, optionValue: DesignerJsonValue, fallback: string) => string
  materialSlotTitle: (material: DesignerMaterialDefinition, slotName: string, fallback: string) => string
}
