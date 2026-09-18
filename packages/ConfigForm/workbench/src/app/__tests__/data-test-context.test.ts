import type { PageGraph } from '@moluoxixi/config-form-model'
import { PAGE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createWorkbenchDataTestContext } from '../services/data-test-context'

describe('workbench data test context', () => {
  it('snapshots reactive graph and values before creating the Core value store', () => {
    const graph = reactive<PageGraph>({
      version: PAGE_GRAPH_VERSION,
      props: {},
      form: {},
      root: [{ nodeId: 'name-node', placement: {} }],
      nodesById: {
        'name-node': {
          id: 'name-node',
          kind: 'field',
          component: 'test.input',
          field: 'name',
          props: {},
          bindings: {},
        },
      },
    })
    const values = reactive({ name: 'Ada' })

    const context = createWorkbenchDataTestContext(graph, values)

    expect(context.resolveField?.('name-node', 'current')).toEqual({ found: true, value: 'Ada' })
  })
})
