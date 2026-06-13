// 方案 B：自研管线 = @vue/compiler-sfc（项目已装，版本与运行时 vue 严格一致）+ sucrase（剥 TS）。
// 模拟 Vue SFC Playground 的核心思路：浏览器内把 SFC 字符串编译成一个可挂载的组件对象。
//
// 管线：parse → compileScript(含 setup 宏展开) → compileTemplate → sucrase 转 TS→JS
//        → new Function 执行 script 拿到组件对象 → 注入 render 函数 → 注入 scoped 样式

import {
  compileScript,
  parse,
} from '@vue/compiler-sfc'
import { transform as sucraseTransform } from 'sucrase'
import * as vueRuntime from 'vue'

export interface CompileResult {
  component: Record<string, unknown>
  scopedStyles: string[]
}

let uid = 0

// 让编译产物里的 import 能在浏览器拿到模块（spike 只需支持 'vue'）。
function resolveModule(name: string): unknown {
  if (name === 'vue')
    return vueRuntime
  throw new Error(`[spike-B] 不支持的 import: ${name}（spike 只解析 'vue'）`)
}

export function compileSfcDIY(source: string, filename = `Anon_${uid++}.vue`): CompileResult {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length)
    throw new Error(`[spike-B] parse 失败: ${errors.map(e => String(e)).join('; ')}`)

  const id = `data-v-${(uid++).toString(36)}`
  const hasScoped = descriptor.styles.some(s => s.scoped)

  // 关键决策：用 inlineTemplate: true 一次性编译。
  // 模板被内联进 setup 闭包，直接访问所有 setup 绑定（props/ref/computed），
  // 无需在 script 与 template 之间手工传递 bindingMetadata —— 这是 SFC Playground 的稳妥做法。
  // （分开编译 + inlineTemplate:false 会导致 render 找不到 `props` 等 setup 绑定。）
  const scriptResult = compileScript(descriptor, {
    id,
    inlineTemplate: true,
    templateOptions: {
      scoped: hasScoped,
      compilerOptions: { scopeId: hasScoped ? id : undefined },
    },
  })

  // sucrase 把 compileScript 产出的 TS 代码剥成纯 JS
  const jsScript = sucraseTransform(scriptResult.content, {
    transforms: ['typescript'],
    keepUnusedImports: true,
  }).code

  // 执行 script，拿到默认导出的组件对象（render 已内联，无需单独注入）
  const component = evalModule(jsScript) as Record<string, unknown>

  if (hasScoped)
    (component as any).__scopeId = id

  const scopedStyles = descriptor.styles.map(s => s.content)

  return { component, scopedStyles }
}

// 极简 ESM 垫片：把 import 改写成 __require()，把 export default / export const X 收集进 __exports。
// 注意：命名导入的别名 `a as b` 在解构里必须写成 `a: b`，否则语法错。
function evalModule(code: string, namedExport?: string): unknown {
  // import { a, b as c } from 'vue'  → const { a, b: c } = __require('vue')
  let rewritten = code
    .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = __require("$2")')
    .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_m, names: string, mod: string) => {
      // 把 `ref as _ref` → `ref: _ref`，普通项保持不变
      const destructured = names
        .split(',')
        .map(n => n.trim())
        .filter(Boolean)
        .map(n => n.replace(/\s+as\s+/, ': '))
        .join(', ')
      return `const { ${destructured} } = __require("${mod}")`
    })
    .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = __require("$2").default || __require("$2")')

  // export default X  → __exports.default = X
  rewritten = rewritten.replace(/export\s+default\s+/g, '__exports.default = ')
  // export function render → __exports.render = function render
  rewritten = rewritten.replace(/export\s+function\s+(\w+)/g, '__exports.$1 = function $1')
  rewritten = rewritten.replace(/export\s+const\s+(\w+)\s*=/g, '__exports.$1 =')

  const factory = new Function('__require', '__exports', `${rewritten}\nreturn __exports;`)
  const exports: Record<string, unknown> = {}
  factory(resolveModule, exports)

  if (namedExport)
    return exports
  return exports.default ?? exports
}
