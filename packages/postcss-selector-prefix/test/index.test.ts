import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { describe, expect, it } from 'vitest'
import createSelectorPrefixPlugin, { createSelectorPrefixPlugin as createSelectorPrefixPluginNamed } from '../index'

const EL_TO_MOLUOXIXI = {
  fromPrefix: 'el-',
  toPrefix: 'moluoxixi-',
}

/**
 * 解析 selector AST，避免属性选择器引号等序列化差异造成平台假失败。
 */
function collectBuiltSelectorTokens(css: string): {
  atRules: Set<string>
  attributes: Set<string>
  classes: Set<string>
  ids: Set<string>
  tags: Set<string>
} {
  const tokens = {
    atRules: new Set<string>(),
    attributes: new Set<string>(),
    classes: new Set<string>(),
    ids: new Set<string>(),
    tags: new Set<string>(),
  }
  const root = postcss.parse(css)

  root.walkAtRules((atRule) => {
    tokens.atRules.add(`${atRule.name} ${atRule.params}`)
  })

  root.walkRules((rule) => {
    selectorParser((selectors) => {
      selectors.walkAttributes((node) => {
        tokens.attributes.add(`${node.attribute}${node.operator ?? ''}${node.value ?? ''}`)
      })
      selectors.walkClasses((node) => {
        tokens.classes.add(node.value)
      })
      selectors.walkIds((node) => {
        tokens.ids.add(node.value)
      })
      selectors.walkTags((node) => {
        tokens.tags.add(node.value)
      })
    }).processSync(rule.selector)
  })

  return tokens
}

describe('createSelectorPrefixPlugin', () => {
  it('exports the same factory as named and default exports', () => {
    expect(createSelectorPrefixPlugin).toBe(createSelectorPrefixPluginNamed)
  })

  it('rewrites only matching class and id selector prefixes', async () => {
    const result = await postcss([
      createSelectorPrefixPlugin(EL_TO_MOLUOXIXI),
    ]).process(`
button,
el-button,
.xxx,
#xxx,
    .el-button.el-active,
    #el-app:hover,
    :is(.el-card, #el-panel) > .el-icon,
    [class^="el-"],
    [id="el-app"],
    [data-role="el-button"],
    [class],
    [id],
    .not-el-button {
  color: red;
}
`, { from: undefined })

    expect(result.css).toContain('button')
    expect(result.css).toContain('el-button')
    expect(result.css).toContain('.xxx')
    expect(result.css).toContain('#xxx')
    expect(result.css).toContain('.moluoxixi-button.moluoxixi-active')
    expect(result.css).toContain('#moluoxixi-app:hover')
    expect(result.css).toContain('.moluoxixi-card')
    expect(result.css).toContain('#moluoxixi-panel')
    expect(result.css).toContain('.moluoxixi-icon')
    expect(result.css).toContain('[class^="moluoxixi-"]')
    expect(result.css).toContain('[id="moluoxixi-app"]')
    expect(result.css).toContain('[data-role="el-button"]')
    expect(result.css).not.toContain('[data-role=el-button]')
    expect(result.css).toContain('[class]')
    expect(result.css).toContain('[id]')
    expect(result.css).toContain('.not-el-button')
    expect(result.css).not.toContain('.el-button.el-active')
    expect(result.css).not.toContain('#el-app:hover')
    expect(result.css).not.toContain(':is(.el-card, #el-panel) > .el-icon')
  })

  it('rewrites class and id attribute selectors without requiring class or id selectors in the same rule', async () => {
    const result = await postcss([
      createSelectorPrefixPlugin(EL_TO_MOLUOXIXI),
    ]).process(`
[class^="el-"] {
  color: red;
}

[class~="el-button"] {
  color: green;
}

[id="el-app"] {
  color: blue;
}

[data-role="el-button"] {
  color: black;
}
`, { from: undefined })

    expect(result.css).toContain('[class^="moluoxixi-"]')
    expect(result.css).toContain('[class~="moluoxixi-button"]')
    expect(result.css).toContain('[id="moluoxixi-app"]')
    expect(result.css).toContain('[data-role="el-button"]')
    expect(result.css).not.toContain('[data-role=el-button]')
    expect(result.css).not.toContain('[class^="el-"]')
    expect(result.css).not.toContain('[class~="el-button"]')
    expect(result.css).not.toContain('[id="el-app"]')
  })

  it('rewrites selector-like text inside values but keeps urls intact', async () => {
    const result = await postcss([
      createSelectorPrefixPlugin(EL_TO_MOLUOXIXI),
    ]).process(`
.el-button {
  content: '.el-button #el-app [class^="el-"] [id="el-app"]';
  --selector-fragment: '.el-button #el-app';
  background-image: url(".el-button.svg");
}

@supports selector(.el-button) {
  .el-button {
    color: red;
  }
}
`, { from: undefined })

    expect(result.css).toContain('content: \'.moluoxixi-button #moluoxixi-app [class^="moluoxixi-"] [id="moluoxixi-app"]\'')
    expect(result.css).toContain('--selector-fragment: \'.moluoxixi-button #moluoxixi-app\'')
    expect(result.css).toContain('@supports selector(.moluoxixi-button)')
    expect(result.css).toContain('background-image: url(".el-button.svg")')
  })

  it('keeps keyframes, animation names, and pure tag selectors unchanged', async () => {
    const result = await postcss([
      createSelectorPrefixPlugin(EL_TO_MOLUOXIXI),
    ]).process(`
el-spinner {
  display: inline-block;
}

@keyframes el-spin {
  from {
    opacity: 0;
  }

  50% {
    opacity: 0.5;
  }

  to {
    opacity: 1;
  }
}

@-webkit-keyframes el-fade {
  50% {
    opacity: 0.5;
  }
}

.el-loading {
  animation: el-spin 1s linear infinite;
}
`, { from: undefined })

    expect(result.css).toContain('el-spinner')
    expect(result.css).toContain('@keyframes el-spin')
    expect(result.css).toContain('@-webkit-keyframes el-fade')
    expect(result.css).toContain('50%')
    expect(result.css).toContain('animation: el-spin 1s linear infinite')
    expect(result.css).toContain('.moluoxixi-loading')
    expect(result.css).not.toContain('.el-loading')
  })

  it('runs through a plain PostCSS processor pipeline without Vite', async () => {
    const result = await postcss([
      createSelectorPrefixPlugin(EL_TO_MOLUOXIXI),
    ]).process(`
el-button {
  display: inline-flex;
}

@keyframes el-spin {
  50% {
    opacity: 0.5;
  }
}

.el-button,
[class^="el-"],
[id="el-app"],
#el-app {
  animation: el-spin 1s linear infinite;
  color: rgb(15 23 42);
}
`, { from: undefined })

    const cssOutput = result.css
    const selectorTokens = collectBuiltSelectorTokens(cssOutput)

    expect(selectorTokens.classes).toContain('moluoxixi-button')
    expect(selectorTokens.attributes).toContain('class^=moluoxixi-')
    expect(selectorTokens.attributes).toContain('id=moluoxixi-app')
    expect(selectorTokens.ids).toContain('moluoxixi-app')
    expect(selectorTokens.tags).toContain('el-button')
    expect(selectorTokens.atRules).toContain('keyframes el-spin')
    expect(cssOutput).toContain('el-spin')
    expect(selectorTokens.classes).not.toContain('el-button')
    expect(selectorTokens.attributes).not.toContain('class^=el-')
    expect(selectorTokens.attributes).not.toContain('id=el-app')
    expect(selectorTokens.ids).not.toContain('el-app')
  })
})
