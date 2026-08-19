import antfu from '@antfu/eslint-config'

const markdownFormatter = {
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
}

export default antfu({
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
  ignores: [
    'AGENTS.md',
    '**/dist',
    '.agents/**',
    '.codex/**',
    '.moluoxixi/**',
    '.trellis/**',
    'spikes/**',
  ],
  rules: {},
}, markdownFormatter)
