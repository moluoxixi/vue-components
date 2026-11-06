import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const require = createRequire(import.meta.url)
const roots = ':where(.ep-docs, .epd-popper, .epd-overlay, .epd-message, .epd-notification, .VPLocalSearchBox, .VPNavBarSearch, .DocSearch-Container)'
const searchRoots = ':where(.VPLocalSearchBox, .VPNavBarSearch, .DocSearch-Container)'
const rawGuard = ':not(:where(.vp-raw, .vp-raw *))'
const ownedSurface = ':where(.ep-docs, .ep-docs *, .epd-popper, .epd-popper *, .epd-overlay, .epd-overlay *, .epd-message, .epd-message *, .epd-notification, .epd-notification *, .VPLocalSearchBox, .VPLocalSearchBox *, .VPNavBarSearch, .VPNavBarSearch *, .DocSearch-Container, .DocSearch-Container *, #nprogress, #nprogress *)'

// Only the pinned search utility tokens/icons are reused, never VitePress's
// global base/reset/prose styles. Original aliases exist only on search roots.
function searchCompatibilityCss(): string {
  const dir = resolve(dirname(require.resolve('vitepress/package.json')), 'dist/client/theme-default/styles')
  const source = ['vars.css', 'icons.css'].map(name => readFileSync(resolve(dir, name), 'utf8')).join('\n')
  const variables = new Set(source.match(/--vp-[\w-]+/g))
  const css = postcss.parse(source.replaceAll('--vp-', '--ep-docs-vp-'))
  css.walkRules((rule) => {
    rule.selectors = rule.selectors.map((selector) => {
      if (selector === ':root')
        return roots
      if (selector === '.dark')
        return `.dark ${roots}`
      return `${roots} ${selector}`
    })
  })
  const aliases = [...variables].map(name => `${name}:var(${name.replace('--vp-', '--ep-docs-vp-')})`).join(';')
  return `${css.toString()}\n${searchRoots}{${aliases}}\n`
}

/** Final published CSS boundary, also covering generated Tailwind/EP selectors. */
export function isolateThemeCss(source: string): string {
  const css = postcss.parse(searchCompatibilityCss() + source)
  css.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes'))
      return
    // Element Plus Sass and Tailwind theme tokens start on :root/:host.
    // Scope these to our shell and owned teleports instead of the document.
    rule.selectors = rule.selectors.map((selector) => {
      if (selector === ':root' || selector === ':host' || selector === 'html:root') {
        rule.walkDecls('color-scheme', decl => decl.remove())
        return roots
      }
      if (selector === 'html.dark' || selector === '.dark') {
        rule.walkDecls('color-scheme', decl => decl.remove())
        return `.dark ${roots}`
      }
      return selector
    })
    // The only document rule is canvas margin. View transitions intentionally
    // belong to the document and don't style elements in a component preview.
    if (rule.selector === 'body' || rule.selector.includes('::view-transition'))
      return
    rule.selector = selectorParser((selectors) => {
      selectors.each((selector) => {
        // The demo wrapper owns its border/padding; its children are consumer UI.
        if (/^\.demo-preview\[data-v-[\w-]+\]$/.test(selector.toString()))
          return
        const guard = selectorParser().astSync(rawGuard).first!.nodes[0].clone()
        const pseudoElement = selector.nodes.find(node => node.type === 'pseudo' && /^::|^:(?:before|after)$/.test(node.value))
        if (pseudoElement)
          selector.insertBefore(pseudoElement, guard)
        else selector.append(guard)
        // SFC scope IDs already establish ownership. Generated/vendor/global
        // selectors must also belong to the shell or one of its portal roots.
        if (!selector.toString().includes('[data-v-') && !selector.toString().includes('.epd-popup-parent--hidden')) {
          const owner = selectorParser().astSync(ownedSurface).first!.nodes[0].clone()
          selector.insertBefore(guard, owner)
        }
      })
    }).processSync(rule.selector)
  })
  return css.toString()
}
