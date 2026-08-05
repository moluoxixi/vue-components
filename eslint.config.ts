import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '**/dist',
    '.agents/**',
    '.codex/**',
    '.moluoxixi/**',
    'spikes/**',
  ],
  rules: {},
})
