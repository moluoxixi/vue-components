import { Linter } from 'eslint'
import format from 'eslint-plugin-format'
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript'

// Adapted from Element Plus docs/.vitepress/utils/ts2js.ts at the commit recorded in UPSTREAM.md.
const scriptRegExp = /<script(?<attributes>[^>]*)>(?<script>[\s\S]*?)<\/script>/g
const typeScriptLangRegExp = /(?<=^|\s)lang\s*=\s*(['"])(ts|tsx)\1/
const sfcFormatter = new Linter({ configType: 'eslintrc' })
sfcFormatter.defineRule('format/prettier', format.rules.prettier)
sfcFormatter.defineParser('plain', format.parserPlain)

const vueFormatConfig: Linter.LegacyConfig = {
  parser: 'plain',
  rules: {
    'format/prettier': ['error', {
      arrowParens: 'avoid',
      endOfLine: 'auto',
      parser: 'vue',
      printWidth: 120,
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'all',
      useTabs: false,
    }],
  },
}

interface TypeScriptScriptMatch {
  attributes: string
  lang: 'ts' | 'tsx'
  script: string
}

export function formatSfcTypeScript(content: string): string {
  return formatVueSfc(content)
}

export function sfcTs2js(content: string): string {
  const javaScript = transformTypeScriptScripts(content, ({ attributes, lang, script }) => {
    const javaScriptAttributes = lang === 'tsx'
      ? attributes.replace(typeScriptLangRegExp, 'lang="jsx"')
      : attributes.replace(typeScriptLangRegExp, '').replace(/\s+$/, '')
    return `<script${javaScriptAttributes}>\n${ts2Js(script)}\n</script>`
  })

  return javaScript === content ? content : formatVueSfc(javaScript)
}

function transformTypeScriptScripts(
  content: string,
  transform: (match: TypeScriptScriptMatch) => string,
): string {
  return content.replace(scriptRegExp, (matched, attributes: string, script: string) => {
    const lang = typeScriptLangRegExp.exec(attributes)?.[2] as 'ts' | 'tsx' | undefined
    if (!lang)
      return matched

    return transform({
      attributes,
      lang,
      script,
    })
  })
}

function formatVueSfc(content: string): string {
  const report = sfcFormatter.verifyAndFix(content, vueFormatConfig, { filename: 'demo.vue' })
  if (report.messages.length > 0) {
    const diagnostics = report.messages
      .map(message => `${message.line}:${message.column} ${message.message}`)
      .join('\n')
    throw new Error(`Failed to format demo SFC:\n${diagnostics}`)
  }

  return report.output.trim()
}

function ts2Js(content: string): string {
  const result = transpileModule(content, {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ESNext,
      jsx: JsxEmit.Preserve,
      verbatimModuleSyntax: true,
    },
  })
  return result.outputText.trim()
}
