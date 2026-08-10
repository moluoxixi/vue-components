import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript'

// Adapted from Element Plus docs/.vitepress/utils/ts2js.ts at the commit recorded in UPSTREAM.md.
const scriptRegExp = /<script(?<attributes>[^>]*)>(?<script>[\s\S]*?)<\/script>/g

export function sfcTs2js(content: string): string {
  for (const matched of content.matchAll(scriptRegExp)) {
    if (matched.index === undefined)
      continue

    const attributes = matched.groups?.attributes ?? ''
    const lang = /\blang="(ts|tsx)"/.exec(attributes)?.[1]
    if (!lang)
      continue

    const script = matched.groups?.script ?? ''
    const header = content.slice(0, matched.index)
    const footer = content.slice(matched.index + matched[0].length)
    const jsLangAttr = lang === 'tsx' ? ' lang="jsx"' : ''
    return `${header}<script${jsLangAttr} setup>\n${ts2Js(script)}\n</script>${footer}`
  }

  return content
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
