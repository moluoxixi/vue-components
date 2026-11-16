import ts from 'typescript'

/**
 * 将 Vue SFC 示例源码里的 `<script setup lang="ts">` 确定性转译为 JS 版本。
 *
 * 设计取舍（见 USER 决策）：TS/JS 双码不让 LLM 各输出一份（费 token 且易漂移），
 * 而是从 LLM 给的 TS 源单向、确定性地转出 JS——保证两份永远语义一致。
 * 仅做类型剥离（type-only import/注解/泛型/`as`/`!` 等），不降级语法，
 * template 与 `<style>` 原样保留，只改 `<script setup>` 块体与其 lang 标记。
 *
 * 不静默吞错：源码不含可识别的 ts script 块时返回 undefined（调用方据此判定无独立 JS，
 * 前端隐藏 JS 切换，绝不伪造一份与 TS 相同的“假 JS”）。
 */

/** 判断 `<script>` 开标签是否声明 `lang="ts"`（lang 在 setup 前后、单双引号均可）。 */
const LANG_TS_ATTR_RE = /(?:^|\s)lang\s*=\s*(['"])ts\1/i

interface ScriptBlock {
  full: string
  openTag: string
  body: string
  closeTag: string
}

/** 扫描第一个带 `lang="ts"` 的 script 块；不解析模板 AST，只处理 SFC 顶层标签文本。 */
function findTsScriptBlock(sfcSource: string): ScriptBlock | null {
  const lower = sfcSource.toLowerCase()
  let searchFrom = 0
  while (true) {
    const start = lower.indexOf('<script', searchFrom)
    if (start < 0)
      return null

    const openEnd = sfcSource.indexOf('>', start)
    if (openEnd < 0)
      return null

    const closeStart = lower.indexOf('</script>', openEnd + 1)
    if (closeStart < 0)
      return null

    const closeEnd = closeStart + '</script>'.length
    const openTag = sfcSource.slice(start, openEnd + 1)
    if (LANG_TS_ATTR_RE.test(openTag)) {
      return {
        full: sfcSource.slice(start, closeEnd),
        openTag,
        body: sfcSource.slice(openEnd + 1, closeStart),
        closeTag: sfcSource.slice(closeStart, closeEnd),
      }
    }

    searchFrom = closeEnd
  }
}

/** 从开标签里移除 `lang="ts"`（JS 版不需要 lang 标记）。 */
function stripLangAttr(openTag: string): string {
  return openTag.replace(/\s+lang\s*=\s*(['"])ts\1/i, '')
}

/**
 * 把一段 TS 代码转为等价 JS：剥离类型注解、type-only import、泛型、`as`/`satisfies`/`!`。
 * 保留 ESNext 模块与语法，不做 target 降级（预览运行在现代浏览器）。
 */
function transpileScriptBody(tsCode: string): string | undefined {
  const out = ts.transpileModule(tsCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      // 仅剥离类型，不引入 helper、不改模块形态。
      isolatedModules: true,
      // 关键：Vue SFC 里组件等 value import 是供 <template> 使用的，但 transpileModule
      // 只能看到 <script> 块、看不到 template，默认会把这些“看似未使用”的 import 当死代码删除，
      // 导致 JS 版丢失 `import { PopoverTableSelect }` 这类导入、复制出去跑不起来。
      // verbatimModuleSyntax 让 value import 一律原样保留，仅剥离显式 `import type`，
      // 既去掉类型导入又不误删组件导入，正好契合 SFC 语义。
      verbatimModuleSyntax: true,
      removeComments: false,
    },
    reportDiagnostics: true,
  })
  if (out.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error))
    return undefined
  // 末尾去掉 transpile 可能追加的多余空行，保持源码整洁。
  return out.outputText.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n')
}

/**
 * 转译 SFC 源：找到 ts script setup 块，转其块体为 JS 并去掉 lang="ts"。
 * @param sfcSource 完整 SFC 源码（含 template）。
 * @returns JS 版 SFC 源；无 ts script 块时返回 undefined（表示无独立 JS）。
 */
export function transpileSfcToJs(sfcSource: string): string | undefined {
  const block = findTsScriptBlock(sfcSource)
  if (!block)
    return undefined
  const jsBody = transpileScriptBody(block.body)
  if (!jsBody)
    return undefined
  const jsScript = `${stripLangAttr(block.openTag)}\n${jsBody.replace(/^\n+|\n+$/g, '')}\n${block.closeTag}`
  return sfcSource.replace(block.full, jsScript)
}
