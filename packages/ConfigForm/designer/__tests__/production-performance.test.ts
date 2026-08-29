import type { DesignerFieldMaterialDefinition, LowCodePageModel } from '../index'
import { describe, expect, it, vi } from 'vitest'
import {
  applyModelOperation,
  createDesignerRegistry,
  createDesignerRuntimeProjection,
  createLowCodeComponentRegistry,
  reduceDesignerCommand,
} from '../index'
import { createDesignerDragController } from '../src/components/designer-drag'

const material: DesignerFieldMaterialDefinition = {
  key: 'benchmark.input',
  version: 1,
  kind: 'field',
  title: 'Input',
  category: 'Fields',
  runtime: { component: 'input' },
  source: { configComponent: 'text', render: 'component', tag: 'input' },
  setters: [{ key: 'placeholder', label: 'Placeholder', path: ['props', 'placeholder'], control: 'text' }],
  createNode: ({ id, field = id }) => ({
    id,
    field,
    kind: 'field',
    material: 'benchmark.input',
    props: { placeholder: 'Type here' },
  }),
}

const designerRegistry = createDesignerRegistry([{
  name: 'benchmark',
  materials: [material],
}])
const registry = createLowCodeComponentRegistry(designerRegistry)

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
}

function measure(iterations: number, operation: (index: number) => void): number[] {
  return Array.from({ length: iterations }, (_, index) => {
    const startedAt = performance.now()
    operation(index)
    return performance.now() - startedAt
  })
}

function productionModel(): LowCodePageModel {
  return {
    id: 'benchmark-page',
    name: 'Benchmark page',
    version: 1,
    props: {},
    form: {},
    nodes: Array.from({ length: 200 }, (_, index) => registry.createNode('benchmark.input', {
      id: `field-${index}`,
      field: `field_${index}`,
    })),
  }
}

describe('designer production performance budgets', () => {
  it('keeps a normal 200-node model operation below the 8ms p95 budget', () => {
    const model = productionModel()
    const update = (index: number): void => {
      const result = applyModelOperation(model, {
        type: 'updateProps',
        nodeId: `field-${index % model.nodes.length}`,
        props: { placeholder: `Value ${index}` },
      }, registry)
      expect(result.success).toBe(true)
    }
    measure(20, update)

    expect(percentile95(measure(100, update))).toBeLessThanOrEqual(8)
  })

  it('keeps a 200-target drag hot path below one 60Hz frame at p95', () => {
    const document = {
      version: 1 as const,
      form: {},
      nodes: Array.from({ length: 200 }, (_, index) => designerRegistry.createNode('benchmark.input', {
        id: `field-${index}`,
        field: `field_${index}`,
      })),
    }
    const candidate = designerRegistry.createNode('benchmark.input', {
      id: 'benchmark-candidate',
      field: 'candidate_benchmark_candidate',
    })
    const targets = Array.from({ length: 200 }, (_, index) => ({ parentId: null, index }))
    const controller = createDesignerDragController({
      commitMaterial: vi.fn(),
      commitNode: vi.fn(),
    })
    controller.registerResolver((pointer) => {
      const index = Math.min(targets.length - 1, Math.max(0, Math.floor(pointer.y / 8)))
      return targets[index]
    })
    controller.beginMaterial('benchmark.input', 'benchmark-candidate', { x: 0, y: 0 })
    controller.move({ x: 20, y: 20 })

    const dragFrame = (index: number): void => {
      controller.move({ x: 40, y: 40 + index })
      const target = controller.session.value?.target
      if (!target)
        return
      const projection = reduceDesignerCommand(document, {
        type: 'addNode',
        node: candidate,
        target,
      }, designerRegistry)
      expect(projection.changed).toBe(true)
      createDesignerRuntimeProjection(projection.document, designerRegistry)
    }

    expect(percentile95(measure(180, dragFrame))).toBeLessThanOrEqual(16.7)
  })
})
