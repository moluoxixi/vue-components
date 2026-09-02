import type { DesignerJsonValue } from '../../graph'
import type { DesignerMaterialDefinition } from '../../registry'
import type { DesignerLocale, DesignerLocaleOptions, DesignerMaterialLocale } from '../types'
import { inject } from 'vue'
import { DESIGNER_LOCALE_KEY } from '../constants'

function interpolate(value: string, params?: Record<string, unknown>): string {
  if (!params)
    return value
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

function optionLocaleKey(value: DesignerJsonValue): string {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
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
    materialSetterOptionLabel: (material, setterKey, optionValue, fallback) => {
      const optionKey = optionLocaleKey(optionValue)
      return materialEntry(material)?.options?.[setterKey]?.[optionKey]
        ?? t(`material.${material.key}.option.${setterKey}.${optionKey}`, fallback)
    },
    materialSlotTitle: (material, slotName, fallback) => materialEntry(material)?.slots?.[slotName]
      ?? t(`material.${material.key}.slot.${slotName}`, fallback),
  }
}

const defaultDesignerLocale = createDesignerLocale()

export function useDesignerLocale(): DesignerLocale {
  return inject(DESIGNER_LOCALE_KEY, defaultDesignerLocale)
}
