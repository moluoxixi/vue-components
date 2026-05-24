import { describe, expect, it, vi } from 'vitest'

const parserState = vi.hoisted((): { ast: Record<string, unknown> } => ({
  ast: {
    program: {
      body: [
        {
          source: {
            value: '@moluoxixi/config-form',
          },
          specifiers: [],
          type: 'ImportDeclaration',
        },
      ],
      type: 'Program',
    },
    type: 'File',
  },
}))

vi.mock('@babel/parser', () => ({
  parse: () => parserState.ast,
}))

describe('source injection errors', () => {
  it('throws when an import source location is unavailable during adapter rewriting', async () => {
    const { transformDefineFieldSource } = await import('../src/sourceInject')

    expect(() => transformDefineFieldSource({
      adapterModuleId: 'virtual:config-form-devtools/config-form',
      code: 'import { ConfigForm } from \'@moluoxixi/config-form\'',
      id: 'D:/project-new/ConfigForm/playgrounds/demo.ts',
    })).toThrow(/Missing import source location/)
  })

  it('throws when a defineField object location is unavailable', async () => {
    parserState.ast = {
      program: {
        body: [
          {
            source: {
              end: 52,
              start: 31,
              value: '@moluoxixi/config-form',
            },
            specifiers: [
              {
                imported: { name: 'defineField', type: 'Identifier' },
                local: { name: 'defineField', type: 'Identifier' },
                type: 'ImportSpecifier',
              },
            ],
            type: 'ImportDeclaration',
          },
          {
            expression: {
              arguments: [
                {
                  properties: [],
                  type: 'ObjectExpression',
                },
              ],
              callee: {
                name: 'defineField',
                type: 'Identifier',
              },
              type: 'CallExpression',
            },
            type: 'ExpressionStatement',
          },
        ],
        type: 'Program',
      },
      type: 'File',
    }
    const { transformDefineFieldSource } = await import('../src/sourceInject')

    expect(() => transformDefineFieldSource({
      adapterModuleId: 'virtual:config-form-devtools/config-form',
      code: 'import { defineField } from \'@moluoxixi/config-form\'\ndefineField({})',
      id: 'D:/project-new/ConfigForm/playgrounds/demo.ts',
    })).toThrow(/Missing source location for defineField/)
  })
})
