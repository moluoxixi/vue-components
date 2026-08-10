import type { ComponentContract } from '../src/core/types'
import { describe, expect, it, vi } from 'vitest'
import { normalizeComponentApiContract } from '../src/api-contract'

function createContract(): ComponentContract {
  return {
    description: 'Copies text',
    emits: [{ description: '', name: 'copied', payloadType: 'string', typeRefs: [] }],
    exposed: [{ description: 'Copy now', name: 'copy', type: '() => Promise<void>', typeRefs: [] }],
    models: [],
    name: 'CopyText',
    packageName: '@fixture/components',
    props: [{
      defaultValue: 'undefined',
      description: '',
      name: 'text',
      required: true,
      type: 'CopyValue',
      typeRefs: ['CopyValue'],
    }],
    slots: [{ description: 'Trigger content', name: 'default', scopeType: '{}', typeRefs: [] }],
    sourceFile: '/fixture/CopyText.vue',
    typeDefs: [{ fields: [], kind: 'type', name: 'CopyValue', raw: 'type CopyValue = string' }],
  }
}

describe('normalizeComponentApiContract', () => {
  it('normalizes every public surface and delegates type details', () => {
    const resolveTypeDetail = vi.fn(({ type }: { type: string }) => `details:${type}`)

    const result = normalizeComponentApiContract(createContract(), { resolveTypeDetail })

    expect(result).toMatchObject({
      description: 'Copies text',
      emits: [{ description: '—', name: 'copied', type: 'string' }],
      expose: [{ description: 'Copy now', name: 'copy', type: '() => Promise<void>' }],
      name: 'CopyText',
      props: [{ default: undefined, description: '—', name: 'text', required: true, type: 'CopyValue' }],
      slots: [{ description: 'Trigger content', name: 'default', type: '{}' }],
    })
    expect(result.props[0]?.typeDetail).toBe('details:CopyValue')
    expect(resolveTypeDetail).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CopyValue',
      typeRefs: ['CopyValue'],
    }))
  })

  it('preserves concrete defaults and supports a custom empty description', () => {
    const contract = createContract()
    contract.props[0]!.defaultValue = '\u0027ready\u0027'

    const result = normalizeComponentApiContract(contract, { emptyDescription: 'Not documented' })

    expect(result.props[0]).toMatchObject({ default: '\u0027ready\u0027', description: 'Not documented' })
  })

  it('normalizes omitted exposes and empty surface descriptions', () => {
    const contract = createContract()
    contract.exposed = undefined
    contract.slots[0]!.description = ''

    const resultWithoutExpose = normalizeComponentApiContract(contract)

    expect(resultWithoutExpose.expose).toEqual([])
    expect(resultWithoutExpose.slots[0]?.description).toBe('—')

    contract.exposed = [{
      description: '',
      name: 'copy',
      type: '() => Promise<void>',
      typeRefs: [],
    }]

    expect(normalizeComponentApiContract(contract).expose[0]?.description).toBe('—')
  })
})
