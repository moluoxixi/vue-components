export interface AstNode {
  type: string
  start?: number | null
  end?: number | null
  loc?: {
    start: {
      line: number
      column: number
    }
  } | null
  [key: string]: unknown
}

export interface ImportDeclarationNode extends AstNode {
  source: AstNode & { value?: unknown }
  specifiers: AstNode[]
}

export interface ImportSpecifierNode extends AstNode {
  imported?: AstNode & { name?: string }
  local?: AstNode & { name?: string }
}

export interface CallExpressionNode extends AstNode {
  callee?: AstNode & { name?: string }
  arguments?: AstNode[]
}

export interface ObjectExpressionNode extends AstNode {
  properties?: AstNode[]
}

export interface ObjectPropertyNode extends AstNode {
  key?: AstNode
  value?: AstNode
}

export interface ArrayExpressionNode extends AstNode {
  elements?: Array<AstNode | null>
}

export interface InlineFunctionExpressionNode extends AstNode {
  type: 'ArrowFunctionExpression' | 'FunctionExpression'
}
