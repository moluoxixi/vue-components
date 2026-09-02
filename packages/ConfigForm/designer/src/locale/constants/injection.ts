import type { InjectionKey } from 'vue'
import type { DesignerLocale } from '../types'

export const DESIGNER_LOCALE_KEY: InjectionKey<DesignerLocale> = Symbol('config-form-designer-locale')
