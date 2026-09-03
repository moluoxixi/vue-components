import type { Plugin } from 'postcss'
import type { SelectorPrefixPluginOptions } from '../types'
import selectorParser from 'postcss-selector-parser'
import valueParser from 'postcss-value-parser'

const PLUGIN_NAME = '@moluoxixi/postcss-selector-prefix'

/**
 * 只替换 selector AST 中 class/id 节点的名称前缀，不触碰声明值或非选择器文本。
 */
function replaceSelectorPrefix(value: string, options: SelectorPrefixPluginOptions): string {
  if (!value.startsWith(options.fromPrefix)) {
    return value
  }

  return `${options.toPrefix}${value.slice(options.fromPrefix.length)}`
}

/**
 * class / id 属性选择器的值也属于 selector 语义，需要和普通 class/id 节点保持一致。
 */
function replaceAttributeSelectorPrefix(attribute: string, value: string, options: SelectorPrefixPluginOptions): string {
  if (attribute !== 'class' && attribute !== 'id') {
    return value
  }

  return replaceSelectorPrefix(value, options)
}

/**
 * 值字符串里只有 selector 语义片段才需要再进入 selector parser；纯文本和 URL 保持原样。
 */
function shouldTransformSelectorLikeText(value: string, options: SelectorPrefixPluginOptions): boolean {
  return value.includes(options.fromPrefix)
    && !value.includes('/')
    && (
      value.includes('.')
      || value.includes('#')
      || value.includes('[')
      || value.includes(':')
      || value.includes('&')
      || value.includes('>')
      || value.includes('+')
      || value.includes('~')
      || value.includes(',')
      || value.includes(' ')
    )
}

/**
 * 对 declaration 值和 at-rule 参数里的 selector-like 文本做同样的前缀替换。
 */
function transformSelectorLikeText(
  value: string,
  options: SelectorPrefixPluginOptions,
  transformSelectorPrefix: (selector: string) => string,
): string {
  const normalizedValue = value.split('\\"').join('"')

  if (!shouldTransformSelectorLikeText(normalizedValue, options)) {
    return value
  }

  return transformSelectorPrefix(normalizedValue)
}

/**
 * 每个插件实例复用一个 selector processor，避免大量 declaration 值触发重复实例化。
 */
function createSelectorTransformer(options: SelectorPrefixPluginOptions): (selector: string) => string {
  let selectorChanged = false
  const processor = selectorParser((selectors) => {
    selectors.walkClasses((node) => {
      const nextValue = replaceSelectorPrefix(node.value, options)

      if (nextValue === node.value) {
        return
      }

      node.value = nextValue
      selectorChanged = true
    })

    selectors.walkIds((node) => {
      const nextValue = replaceSelectorPrefix(node.value, options)

      if (nextValue === node.value) {
        return
      }

      node.value = nextValue
      selectorChanged = true
    })

    selectors.walkAttributes((node) => {
      if (!node.operator) {
        return
      }

      const nextValue = replaceAttributeSelectorPrefix(node.attribute, node.value!, options)

      if (nextValue === node.value) {
        return
      }

      node.setValue(nextValue, { quoteMark: node.quoteMark })
      selectorChanged = true
    })
  })

  return (selector: string): string => {
    selectorChanged = false
    const nextSelector = processor.processSync(selector)

    return selectorChanged ? nextSelector : selector
  }
}

/**
 * 遍历 CSS 值 token，只改写 selector-like 片段，保持纯文本和 URL 不变。
 */
function transformValueLikeText(
  value: string,
  options: SelectorPrefixPluginOptions,
  transformSelectorPrefix: (selector: string) => string,
): string {
  let valueChanged = false
  const ast = valueParser(value)

  ast.walk((node) => {
    if (node.type === 'function' && node.value === 'url') {
      return false
    }

    if (node.type !== 'string' && node.type !== 'word') {
      return
    }

    const nextValue = transformSelectorLikeText(node.value, options, transformSelectorPrefix)

    if (nextValue === node.value) {
      return
    }

    node.value = nextValue
    valueChanged = true
  })

  return valueChanged ? ast.toString() : value
}

/**
 * 创建一个 PostCSS 插件，在 selector AST 中替换 class 与 id 选择器的名称前缀。
 */
export function createSelectorPrefixPlugin(options: SelectorPrefixPluginOptions): Plugin {
  const transformSelectorPrefix = createSelectorTransformer(options)

  return {
    postcssPlugin: PLUGIN_NAME,
    Rule(rule) {
      rule.selector = transformSelectorPrefix(rule.selector)
    },
    Declaration(decl) {
      decl.value = transformValueLikeText(decl.value, options, transformSelectorPrefix)
    },
    AtRule(atRule) {
      atRule.params = transformValueLikeText(atRule.params, options, transformSelectorPrefix)
    },
  }
}

export default createSelectorPrefixPlugin
