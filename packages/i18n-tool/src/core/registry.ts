import type { I18nDiagnostic, LocaleAdapter, LocaleAdapterId } from './types'
import { genericJsonAdapter } from './adapters/generic-json'
import { i18nextJsonAdapter } from './adapters/i18next-json'
import { vueI18nJsonAdapter } from './adapters/vue-i18n-json'

export interface LocaleAdapterRegistry {
  get: (id: LocaleAdapterId) => LocaleAdapter | undefined
  list: () => readonly LocaleAdapter[]
  require: (id: LocaleAdapterId) => { adapter?: LocaleAdapter, diagnostics: readonly I18nDiagnostic[] }
}

export function createLocaleAdapterRegistry(
  adapters: readonly LocaleAdapter[],
): LocaleAdapterRegistry {
  const byId = new Map(adapters.map(adapter => [adapter.id, adapter]))
  return {
    get: id => byId.get(id),
    list: () => [...byId.values()],
    require: (id) => {
      const adapter = byId.get(id)
      return adapter
        ? { adapter, diagnostics: [] }
        : {
            diagnostics: [{
              code: 'ADAPTER_NOT_FOUND',
              message: `Locale adapter ${id} is not registered.`,
              severity: 'error',
            }],
          }
    },
  }
}

export const defaultLocaleAdapterRegistry = createLocaleAdapterRegistry([
  genericJsonAdapter,
  i18nextJsonAdapter,
  vueI18nJsonAdapter,
])
