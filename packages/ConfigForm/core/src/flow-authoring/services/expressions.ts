import type { ConfigFormExpressionNode } from '../../expression'
import type {
  ConfigFormExpressionOutputAnalysis,
  ConfigFormExpressionOutputReference,
  ConfigFormFlowAuthoringDiagnostic,
} from '../types'
import { CONFIG_FORM_EXPRESSION_FUNCTIONS, parseConfigFormExpression } from '../../expression'

export function analyzeConfigFormExpressionOutputs(
  source: string,
  path: string,
): ConfigFormExpressionOutputAnalysis {
  let expression: ConfigFormExpressionNode
  try {
    expression = parseConfigFormExpression(source)
  }
  catch (cause) {
    const code = typeof cause === 'object' && cause !== null && 'code' in cause
      ? String(cause.code)
      : 'CONFIG_FORM_EXPRESSION_INVALID'
    return {
      references: [],
      diagnostics: [{
        code: 'FLOW_AUTHORING_EXPRESSION_INVALID',
        message: `Invalid expression (${code}).`,
        path,
      }],
    }
  }

  const references: ConfigFormExpressionOutputReference[] = []
  const diagnostics: ConfigFormFlowAuthoringDiagnostic[] = []
  const stack: Array<{ node: ConfigFormExpressionNode, outputRoot: boolean }> = [{ node: expression, outputRoot: false }]
  while (stack.length > 0) {
    const { node, outputRoot } = stack.pop()!
    switch (node.kind) {
      case 'identifier':
        if (node.name === '$outputs' && !outputRoot) {
          diagnostics.push({
            code: 'FLOW_AUTHORING_OUTPUT_EXPRESSION_DYNAMIC',
            message: '$outputs must be followed by a static action id.',
            path,
          })
        }
        break
      case 'member':
        if (node.object.kind === 'identifier' && node.object.name === '$outputs') {
          references.push({ outputId: node.property, path })
        }
        else {
          stack.push({ node: node.object, outputRoot: false })
        }
        break
      case 'index':
        if (node.object.kind === 'identifier' && node.object.name === '$outputs') {
          if (node.index.kind === 'literal' && typeof node.index.value === 'string') {
            references.push({ outputId: node.index.value, path })
          }
          else {
            diagnostics.push({
              code: 'FLOW_AUTHORING_OUTPUT_EXPRESSION_DYNAMIC',
              message: '$outputs access must use a static string action id.',
              path,
            })
            stack.push({ node: node.index, outputRoot: false })
          }
        }
        else {
          stack.push({ node: node.object, outputRoot: false })
          stack.push({ node: node.index, outputRoot: false })
        }
        break
      case 'array':
        for (let index = node.items.length - 1; index >= 0; index -= 1)
          stack.push({ node: node.items[index]!, outputRoot: false })
        break
      case 'unary':
        stack.push({ node: node.operand, outputRoot: false })
        break
      case 'binary':
        stack.push({ node: node.right, outputRoot: false })
        stack.push({ node: node.left, outputRoot: false })
        break
      case 'conditional':
        stack.push({ node: node.alternate, outputRoot: false })
        stack.push({ node: node.consequent, outputRoot: false })
        stack.push({ node: node.test, outputRoot: false })
        break
      case 'call':
        if (node.callee === '$outputs') {
          diagnostics.push({
            code: 'FLOW_AUTHORING_OUTPUT_EXPRESSION_DYNAMIC',
            message: '$outputs cannot be called as a function.',
            path,
          })
        }
        else if (!Object.keys(CONFIG_FORM_EXPRESSION_FUNCTIONS).some(name => name.toUpperCase() === node.callee.toUpperCase())) {
          diagnostics.push({
            code: 'CONFIG_FORM_EXPRESSION_UNKNOWN_FUNCTION',
            message: `Unknown expression function: ${node.callee}.`,
            path,
          })
        }
        for (let index = node.args.length - 1; index >= 0; index -= 1)
          stack.push({ node: node.args[index]!, outputRoot: false })
        break
      case 'literal':
        break
    }
  }
  return { references, diagnostics }
}

export function remapConfigFormExpressionOutputs(
  source: string,
  ids: ReadonlyMap<string, string>,
  path: string,
): { source: string, changed: boolean, diagnostics: ConfigFormFlowAuthoringDiagnostic[] } {
  const analysis = analyzeConfigFormExpressionOutputs(source, path)
  if (analysis.diagnostics.length > 0)
    return { source, changed: false, diagnostics: analysis.diagnostics }
  if (!analysis.references.some(reference => ids.has(reference.outputId)))
    return { source, changed: false, diagnostics: [] }

  const expression = parseConfigFormExpression(source)
  const remapped = remapExpressionNode(expression, ids)
  return {
    source: printExpressionNode(remapped),
    changed: true,
    diagnostics: [],
  }
}

function remapExpressionNode(
  node: ConfigFormExpressionNode,
  ids: ReadonlyMap<string, string>,
): ConfigFormExpressionNode {
  switch (node.kind) {
    case 'literal':
    case 'identifier':
      return node
    case 'member': {
      if (node.object.kind === 'identifier' && node.object.name === '$outputs') {
        const property = ids.get(node.property)
        if (!property)
          return node
        if (/^[a-z_$][\w$]*$/i.test(property))
          return { ...node, property }
        return {
          kind: 'index',
          object: node.object,
          index: { kind: 'literal', value: property },
        }
      }
      return { ...node, object: remapExpressionNode(node.object, ids) }
    }
    case 'index': {
      if (
        node.object.kind === 'identifier'
        && node.object.name === '$outputs'
        && node.index.kind === 'literal'
        && typeof node.index.value === 'string'
      ) {
        const value = ids.get(node.index.value)
        return value === undefined
          ? node
          : { ...node, index: { kind: 'literal', value } }
      }
      return {
        ...node,
        object: remapExpressionNode(node.object, ids),
        index: remapExpressionNode(node.index, ids),
      }
    }
    case 'array':
      return { ...node, items: node.items.map(item => remapExpressionNode(item, ids)) }
    case 'unary':
      return { ...node, operand: remapExpressionNode(node.operand, ids) }
    case 'binary':
      return {
        ...node,
        left: remapExpressionNode(node.left, ids),
        right: remapExpressionNode(node.right, ids),
      }
    case 'conditional':
      return {
        ...node,
        test: remapExpressionNode(node.test, ids),
        consequent: remapExpressionNode(node.consequent, ids),
        alternate: remapExpressionNode(node.alternate, ids),
      }
    case 'call':
      return { ...node, args: node.args.map(argument => remapExpressionNode(argument, ids)) }
  }
}

function printExpressionNode(node: ConfigFormExpressionNode): string {
  switch (node.kind) {
    case 'literal':
      return JSON.stringify(node.value)
    case 'identifier':
      return node.name
    case 'member':
      return `${printPostfixObject(node.object)}.${node.property}`
    case 'index':
      return `${printPostfixObject(node.object)}[${printExpressionNode(node.index)}]`
    case 'array':
      return `[${node.items.map(printExpressionNode).join(', ')}]`
    case 'unary':
      return `(${node.operator}${printExpressionNode(node.operand)})`
    case 'binary':
      return `(${printExpressionNode(node.left)} ${node.operator} ${printExpressionNode(node.right)})`
    case 'conditional':
      return `(${printExpressionNode(node.test)} ? ${printExpressionNode(node.consequent)} : ${printExpressionNode(node.alternate)})`
    case 'call':
      return `${node.callee}(${node.args.map(printExpressionNode).join(', ')})`
  }
}

function printPostfixObject(node: ConfigFormExpressionNode): string {
  if (node.kind === 'identifier' || node.kind === 'member' || node.kind === 'index' || node.kind === 'call')
    return printExpressionNode(node)
  return `(${printExpressionNode(node)})`
}
