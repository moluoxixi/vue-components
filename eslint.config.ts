import antfu from '@antfu/eslint-config'
import vueConventions from './scripts/eslint/vue-explicit-props.mjs'

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
  vue: true,
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
    '.workbuddy/**',
    'spikes/**',
    // Markdown code fences are formatted by Prettier, not the Vue SFC processor.
    '**/*.md/**/*.vue',
  ],
  rules: {},
}, markdownFormatter, {
  files: ['**/*.vue'],
  plugins: { 'project-vue': vueConventions },
  rules: { 'project-vue/explicit-props': 'error', 'vue/custom-event-name-casing': 'off' },
})
