import fs from 'node:fs'
import { compileScript, parse, registerTS } from '@vue/compiler-sfc'
import ts from 'typescript'

registerTS(() => ts)
const compilerFs = {
  fileExists(path) {
    try {
      return fs.statSync(path).isFile()
    }
    catch { return false }
  },
  readFile: path => fs.readFileSync(path, 'utf8'),
}

/** Use Vue's resolved type metadata and the template parser's lexical scopes. */
export const explicitPropsRule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Keep component inputs visibly qualified as props.xxx.' },
    fixable: 'code',
    schema: [],
    messages: {
      qualify: 'Read component input "{{name}}" as props.{{name}}.',
      binding: 'Assign defineProps to const props; keep the object intact.',
      analysis: 'Cannot verify props: {{reason}}',
    },
  },
  create(context) {
    const source = context.sourceCode
    const services = source.parserServices
    if (!services.defineTemplateBodyVisitor || !source.text.includes('defineProps'))
      return {}
    const { descriptor } = parse(source.text, { filename: context.filename })
    if (!descriptor.scriptSetup)
      return {}
    let bindings
    try {
      bindings = compileScript(descriptor, { id: context.filename, fs: compilerFs }).bindings
    }
    catch (error) {
      return { Program(node) {
        context.report({ node, messageId: 'analysis', data: { reason: error.message.split('\n')[0] } })
      } }
    }
    const names = new Set(Object.keys(bindings).filter(name => bindings[name] === 'props'))
    function reportReference(identifier) {
      context.report({
        node: identifier,
        messageId: 'qualify',
        data: { name: identifier.name },
        fix(fixer) {
          const parent = identifier.parent
          const shorthand = parent?.type === 'Property' && parent.shorthand
          return fixer.replaceText(identifier, shorthand ? `${identifier.name}: props.${identifier.name}` : `props.${identifier.name}`)
        },
      })
    }
    return services.defineTemplateBodyVisitor({
      VExpressionContainer(node) {
        for (const reference of node.references ?? []) {
          if (!reference.variable && names.has(reference.id.name))
            reportReference(reference.id)
        }
      },
    }, {
      VariableDeclarator(node) {
        if ((node.init?.type === 'MemberExpression' && node.init.object.type === 'Identifier' && node.init.object.name === 'props') || (node.init?.type === 'Identifier' && node.init.name === 'props'))
          context.report({ node, messageId: 'binding' })
      },
      'CallExpression[callee.name="defineProps"]': function (node) {
        source.markVariableAsUsed('props', node)
        let declaration = node.parent
        if (declaration?.type === 'CallExpression' && declaration.callee.name === 'withDefaults')
          declaration = declaration.parent
        if (declaration?.type !== 'VariableDeclarator' || declaration.id.type !== 'Identifier' || declaration.id.name !== 'props' || declaration.parent.kind !== 'const') {
          context.report({
            node,
            messageId: 'binding',
            fix: declaration?.type === 'ExpressionStatement' ? fixer => fixer.insertTextBefore(declaration, 'const props = ') : undefined,
          })
        }
      },
      'Program:exit': function () {
        for (const reference of source.scopeManager.globalScope.through) {
          if (names.has(reference.identifier.name))
            reportReference(reference.identifier)
        }
      },
    })
  },
}

export default { rules: { 'explicit-props': explicitPropsRule } }
