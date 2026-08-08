import type { InjectionKey } from 'vue'
import type { DesignerMaterialDefinition } from './registry'
import { inject } from 'vue'

export interface DesignerMaterialLocale {
  title?: string
  category?: string
  setters?: Record<string, string>
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
  materialSlotTitle: (material: DesignerMaterialDefinition, slotName: string, fallback: string) => string
}

function interpolate(value: string, params?: Record<string, unknown>): string {
  if (!params)
    return value
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

export function createDesignerLocale(options: DesignerLocaleOptions = {}): DesignerLocale {
  const messages = options.messages ?? {}
  const materials = options.materials ?? {}

  function t(key: string, fallback: string, params?: Record<string, unknown>): string {
    const translated = options.translate?.(key, messages[key] ?? fallback, params) ?? messages[key] ?? fallback
    return interpolate(translated, params)
  }

  function materialEntry(material: DesignerMaterialDefinition): DesignerMaterialLocale | undefined {
    return materials[material.key]
  }

  return {
    locale: options.locale ?? 'en-US',
    t,
    materialTitle: material => materialEntry(material)?.title ?? t(`material.${material.key}.title`, material.title),
    materialCategory: material => materialEntry(material)?.category ?? t(`material.${material.key}.category`, material.category),
    materialSetterLabel: (material, setterKey, fallback) => materialEntry(material)?.setters?.[setterKey]
      ?? t(`material.${material.key}.setter.${setterKey}`, fallback),
    materialSlotTitle: (material, slotName, fallback) => materialEntry(material)?.slots?.[slotName]
      ?? t(`material.${material.key}.slot.${slotName}`, fallback),
  }
}

const defaultDesignerLocale = createDesignerLocale()
export const DESIGNER_LOCALE_KEY: InjectionKey<DesignerLocale> = Symbol('config-form-designer-locale')

export function useDesignerLocale(): DesignerLocale {
  return inject(DESIGNER_LOCALE_KEY, defaultDesignerLocale)
}
