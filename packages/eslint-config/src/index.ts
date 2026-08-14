import type { EslintConfigOptions, EslintConfigResult, EslintUserConfig } from './types'
import antfu from '@antfu/eslint-config'

const DEFAULT_IGNORES = [
  '.husky/**',
  '**/coverage/**',
  '**/dist/**',
  '**/dist-ssr/**',
  '**/node_modules/**',
]

const DEFAULT_RULES: NonNullable<EslintConfigOptions['rules']> = {
  // 保留旧包对注释边界标记的支持，避免 #region/#endregion 被自动改坏。
  'style/spaced-comment': ['error', 'always', {
    line: {
      markers: [
        '#region',
        '#endregion',
      ],
    },
  }],
  // Vue SFC 块顺序属于跨项目通用约束，不携带具体业务语义。
  'vue/block-order': ['error', {
    order: ['template', 'script', 'style'],
  }],
}

const MARKDOWN_FORMATTER = {
  files: ['**/*.md'],
  rules: {
    'format/prettier': ['error', {
      arrowParens: 'avoid',
      endOfLine: 'auto',
      embeddedLanguageFormatting: 'auto',
      parser: 'markdown',
      printWidth: 120,
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'all',
      useTabs: false,
    }],
  },
} satisfies EslintUserConfig

export function createEslintConfig(
  options: EslintConfigOptions = {},
  ...userConfigs: EslintUserConfig[]
): EslintConfigResult {
  const { ignores, rules, ...restOptions } = options

  return antfu(
    {
      formatters: {
        markdown: 'prettier',
        prettierOptions: {
          arrowParens: 'avoid',
          endOfLine: 'auto',
          printWidth: 120,
          semi: false,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'all',
          useTabs: false,
        },
      },
      ...restOptions,
      ignores: [
        ...DEFAULT_IGNORES,
        ...(ignores ?? []),
      ],
      rules: {
        ...DEFAULT_RULES,
        ...rules,
      },
    },
    MARKDOWN_FORMATTER,
    ...userConfigs,
  )
}

export type {
  EslintConfigOptions,
  EslintConfigResult,
  EslintUserConfig,
} from './types'

export default createEslintConfig
