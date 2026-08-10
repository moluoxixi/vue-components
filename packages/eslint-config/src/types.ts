import type { Awaitable, OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'

export type EslintConfigOptions = OptionsConfig & Omit<TypedFlatConfigItem, 'files'>

export type EslintUserConfig = Awaitable<TypedFlatConfigItem | TypedFlatConfigItem[]>

export type EslintConfigResult = ReturnType<typeof import('@antfu/eslint-config').default>
