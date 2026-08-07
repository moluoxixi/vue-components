import type { DesignerConditionExpression } from '../condition'
import type {
  DesignerDiagnostic,
  DesignerDocument,
  DesignerMigrationResult,
  DesignerParseResult,
} from './types'
import { DESIGNER_DOCUMENT_VERSION } from '../constants'
import { designerDiagnostic, formatDesignerZodIssues } from './diagnostics'
import { designerDocumentSchema } from './schema'
import { walkDesignerNodes } from './traverse'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findReferenceCycle(
  value: unknown,
  ancestors = new WeakSet<object>(),
  path: (string | number)[] = [],
): (string | number)[] | undefined {
  if (typeof value !== 'object' || value === null)
    return undefined
  if (ancestors.has(value))
    return path

  ancestors.add(value)
  const entries: Array<[string | number, unknown]> = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value)
  for (const [key, child] of entries) {
    const cyclePath = findReferenceCycle(child, ancestors, [...path, key])
    if (cyclePath)
      return cyclePath
  }
  ancestors.delete(value)
  return undefined
}

interface DesignerFieldReference {
  code: 'DESIGNER_CONDITION_FIELD_UNKNOWN' | 'DESIGNER_RULE_FIELD_UNKNOWN'
  field: string
  nodeId: string
  path: (string | number)[]
}

function collectConditionFieldReferences(
  expression: DesignerConditionExpression,
  path: (string | number)[],
  nodeId: string,
  references: DesignerFieldReference[],
): void {
  switch (expression.kind) {
    case 'literal':
      return
    case 'compare':
      if (expression.left.kind === 'field') {
        references.push({
          code: 'DESIGNER_CONDITION_FIELD_UNKNOWN',
          field: expression.left.field,
          nodeId,
          path: [...path, 'left', 'field'],
        })
      }
      if (expression.right.kind === 'field') {
        references.push({
          code: 'DESIGNER_CONDITION_FIELD_UNKNOWN',
          field: expression.right.field,
          nodeId,
          path: [...path, 'right', 'field'],
        })
      }
      return
    case 'and':
    case 'or':
      expression.expressions.forEach((child, index) => {
        collectConditionFieldReferences(child, [...path, 'expressions', index], nodeId, references)
      })
      return
    case 'not':
      collectConditionFieldReferences(expression.expression, [...path, 'expression'], nodeId, references)
  }
}

export function migrateDesignerDocument(input: unknown): DesignerMigrationResult {
  if (!isRecord(input) || typeof input.version !== 'number')
    return { data: input, diagnostics: [] }

  if (input.version !== DESIGNER_DOCUMENT_VERSION) {
    return {
      diagnostics: [designerDiagnostic(
        'DESIGNER_DOCUMENT_VERSION_UNSUPPORTED',
        `Unsupported designer document version: ${input.version}`,
        ['version'],
      )],
    }
  }

  return { data: input, diagnostics: [] }
}

export function validateDesignerDocument(document: DesignerDocument): DesignerDiagnostic[] {
  const diagnostics: DesignerDiagnostic[] = []
  const ids = new Map<string, (string | number)[]>()
  const fields = new Map<string, (string | number)[]>()
  const fieldReferences: DesignerFieldReference[] = []

  walkDesignerNodes(document.nodes, ({ node, path }) => {
    const idPath = [...path, 'id']
    if (ids.has(node.id)) {
      diagnostics.push(designerDiagnostic(
        'DESIGNER_NODE_ID_DUPLICATE',
        `Duplicate designer node id: ${node.id}`,
        idPath,
        'error',
        node.id,
      ))
    }
    else {
      ids.set(node.id, idPath)
    }

    for (const [target, expression] of Object.entries(node.conditions ?? {})) {
      if (expression) {
        collectConditionFieldReferences(
          expression,
          [...path, 'conditions', target],
          node.id,
          fieldReferences,
        )
      }
    }

    if (node.kind === 'field') {
      const fieldPath = [...path, 'field']
      if (fields.has(node.field)) {
        diagnostics.push(designerDiagnostic(
          'DESIGNER_FIELD_DUPLICATE',
          `Duplicate designer field: ${node.field}`,
          fieldPath,
          'error',
          node.id,
        ))
      }
      else {
        fields.set(node.field, fieldPath)
      }

      node.validation?.rules.forEach((rule, index) => {
        if (rule.kind === 'compare') {
          fieldReferences.push({
            code: 'DESIGNER_RULE_FIELD_UNKNOWN',
            field: rule.field,
            nodeId: node.id,
            path: [...path, 'validation', 'rules', index, 'field'],
          })
        }
      })
    }
  })

  for (const reference of fieldReferences) {
    if (!fields.has(reference.field)) {
      diagnostics.push(designerDiagnostic(
        reference.code,
        `Unknown designer field reference: ${reference.field}`,
        reference.path,
        'error',
        reference.nodeId,
      ))
    }
  }

  return diagnostics
}

export function parseDesignerDocument(input: unknown): DesignerParseResult {
  const cyclePath = findReferenceCycle(input)
  if (cyclePath) {
    return {
      success: false,
      diagnostics: [designerDiagnostic(
        'DESIGNER_DOCUMENT_CYCLE',
        'Designer documents cannot contain circular references',
        cyclePath,
      )],
    }
  }

  const migrated = migrateDesignerDocument(input)
  if (migrated.diagnostics.length > 0)
    return { success: false, diagnostics: migrated.diagnostics }

  const result = designerDocumentSchema.safeParse(migrated.data)
  if (!result.success)
    return { success: false, diagnostics: formatDesignerZodIssues(result.error.issues) }

  const diagnostics = validateDesignerDocument(result.data)
  if (diagnostics.length > 0)
    return { success: false, diagnostics }
  return { success: true, data: result.data, diagnostics: [] }
}
