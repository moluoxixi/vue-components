import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkbenchLocaleId } from '../types'
import { DESIGNER_ZH_CN_MESSAGES } from '@moluoxixi/config-form-designer'
import { WORKBENCH_LOCALE_STORAGE_KEY, WORKBENCH_MESSAGES } from '../constants'

export function resolveWorkbenchLocale(value: unknown): WorkbenchLocaleId {
  return typeof value === 'string' && value.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function createWorkbenchLocaleOptions(
  locale: WorkbenchLocaleId,
  adapterLocale: DesignerLocaleOptions | undefined,
  overrides: DesignerLocaleOptions | undefined,
): DesignerLocaleOptions {
  const useAdapterLocale = locale === 'zh-CN'
  return {
    locale,
    messages: {
      ...(useAdapterLocale ? DESIGNER_ZH_CN_MESSAGES : {}),
      ...(useAdapterLocale ? adapterLocale?.messages : {}),
      ...WORKBENCH_MESSAGES[locale],
      ...overrides?.messages,
    },
    materials: {
      ...(useAdapterLocale ? adapterLocale?.materials : {}),
      ...overrides?.materials,
    },
    ...(overrides?.translate ? { translate: overrides.translate } : {}),
  }
}

export function readWorkbenchLocalePreference(storage?: Pick<Storage, 'getItem'>): WorkbenchLocaleId | undefined {
  if (!storage)
    return undefined
  try {
    const value = storage.getItem(WORKBENCH_LOCALE_STORAGE_KEY)
    return value ? resolveWorkbenchLocale(value) : undefined
  }
  catch {
    return undefined
  }
}

export function writeWorkbenchLocalePreference(
  locale: WorkbenchLocaleId,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    storage?.setItem(WORKBENCH_LOCALE_STORAGE_KEY, locale)
  }
  catch {
    // A blocked storage backend must not prevent locale changes.
  }
}
