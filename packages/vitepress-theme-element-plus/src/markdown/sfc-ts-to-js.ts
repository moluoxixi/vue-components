import {
  createPrinter,
  createSourceFile,
  JsxEmit,
  ModuleKind,
  NewLineKind,
  ScriptKind,
  ScriptTarget,
  transpileModule,
} from 'typescript'

// Adapted from Element Plus docs/.vitepress/utils/ts2js.ts at the commit recorded in UPSTREAM.md.
const scriptRegExp = /<script(?<attributes>[^>]*)>(?<script>[\s\S]*?)<\/script>/g
const typeScriptLangRegExp = /(?<=^|\s)lang\s*=\s*(['"])(ts|tsx)\1/
const printer = createPrinter({ newLine: NewLineKind.LineFeed })

interface TypeScriptScriptMatch {
  attributes: string
  lang: 'ts' | 'tsx'
  script: string
}

export function formatSfcTypeScript(content: string): string {
  return transformTypeScriptScripts(content, ({ attributes, lang, script }) => (
    `<script${attributes}>\n${formatTypeScript(script, lang)}\n</script>`
  ))
}

export function sfcTs2js(content: string): string {
  return transformTypeScriptScripts(content, ({ attributes, lang, script }) => {
    const javaScriptAttributes = lang === 'tsx'
      ? attributes.replace(typeScriptLangRegExp, 'lang="jsx"')
      : attributes.replace(typeScriptLangRegExp, '').replace(/\s+$/, '')
    return `<script${javaScriptAttributes}>\n${ts2Js(script)}\n</script>`
  })
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

function formatTypeScript(content: string, lang: 'ts' | 'tsx'): string {
  const source = createSourceFile(
    lang === 'tsx' ? 'demo.tsx' : 'demo.ts',
    content.trim(),
    ScriptTarget.ESNext,
    true,
    lang === 'tsx' ? ScriptKind.TSX : ScriptKind.TS,
  )
  return printer.printFile(source).trim()
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
