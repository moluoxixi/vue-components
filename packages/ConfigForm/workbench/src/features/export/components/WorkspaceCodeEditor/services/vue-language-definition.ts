import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

function configFormHtmlData() {
  return {
    dataProviders: {
      configForm: {
        tags: [
          {
            attributes: [
              { description: 'Bound page model.', name: 'v-model' },
              { description: 'ConfigForm field declarations.', name: ':fields' },
              { description: 'Grid column count.', name: ':columns' },
              { description: 'Default field span.', name: ':field-span' },
              { description: 'Render fields inline.', name: 'inline' },
              { description: 'Render the form as readonly.', name: 'readonly' },
            ],
            description: 'ConfigForm renderer using Element Plus components.',
            name: 'ElementConfigForm',
          },
          {
            attributes: [
              { description: 'Bound page model.', name: 'v-model' },
              { description: 'ConfigForm field declarations.', name: ':fields' },
              { description: 'Grid column count.', name: ':columns' },
              { description: 'Default field span.', name: ':field-span' },
              { description: 'Render fields inline.', name: 'inline' },
              { description: 'Render the form as readonly.', name: 'readonly' },
            ],
            description: 'ConfigForm renderer using Ant Design Vue components.',
            name: 'AntdConfigForm',
          },
        ],
        version: 1.1 as const,
      },
    },
    useDefaultDataProvider: true,
  }
}

export function registerVueLanguageDefinition(): void {
  monaco.languages.register({ extensions: ['.vue'], id: 'vue' })
  monaco.languages.setLanguageConfiguration('vue', {
    autoClosingPairs: [
      { close: '}', open: '{' },
      { close: ']', open: '[' },
      { close: ')', open: '(' },
      { close: '"', open: '"' },
      { close: '\'', open: '\'' },
      { close: '`', open: '`' },
      { close: '>', open: '<' },
    ],
    brackets: [['<', '>'], ['{', '}'], ['[', ']'], ['(', ')']],
    comments: { blockComment: ['<!--', '-->'] },
    surroundingPairs: [
      { close: '}', open: '{' },
      { close: ']', open: '[' },
      { close: ')', open: '(' },
      { close: '"', open: '"' },
      { close: '\'', open: '\'' },
      { close: '`', open: '`' },
      { close: '>', open: '<' },
    ],
  })
  monaco.languages.setMonarchTokensProvider('vue', {
    tokenizer: {
      root: [
        [/(<script\b)([^>]*)(>)/i, [
          { next: '@script', token: 'tag' },
          'attribute.name',
          { nextEmbedded: 'typescript', token: 'tag' },
        ]],
        [/(<style\b)([^>]*)(>)/i, [
          { next: '@style', token: 'tag' },
          'attribute.name',
          { nextEmbedded: 'css', token: 'tag' },
        ]],
        [/(<template\b)([^>]*)(>)/i, [
          { next: '@template', token: 'tag' },
          'attribute.name',
          { nextEmbedded: 'html', token: 'tag' },
        ]],
        [/<!--/, 'comment', '@comment'],
        [/[^<]+/, ''],
        [/<[^>]+>/, 'tag'],
      ],
      script: [
        [/<\/script\s*>/i, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      style: [
        [/<\/style\s*>/i, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      template: [
        [/<\/template\s*>/i, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      comment: [
        [/-->/, 'comment', '@pop'],
        [/./, 'comment'],
      ],
    },
  })
  monaco.languages.html.registerHTMLLanguageService('vue', {
    data: configFormHtmlData(),
    suggest: { html5: true },
  }, {
    completionItems: true,
    documentFormattingEdits: true,
    documentHighlights: true,
    documentSymbols: true,
    foldingRanges: true,
    hovers: true,
    links: true,
    rename: true,
    selectionRanges: true,
  })
}

export function configureWorkbenchHtmlDefaults(): void {
  monaco.languages.html.htmlDefaults.setOptions({
    data: configFormHtmlData(),
    suggest: { html5: true },
  })
}
