import type {
  DesignerContainerMaterialDefinition,
  DesignerDocument,
  DesignerFieldMaterialDefinition,
  LowCodePageModel,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyConfigModelOperation,
  applyModelOperation,
  configModelToDesignerDocument,
  createConfigModelHistory,
  createDesignerRegistry,
  createLowCodeComponentRegistry,
  designerCommandToModelOperation,
  designerDocumentToConfigModel,
  redoConfigModelHistory,
  undoConfigModelHistory,
} from '../index'

const inputMaterial: DesignerFieldMaterialDefinition = {
  key: 'test.input',
  version: 1,
  kind: 'field',
  title: 'Input',
  category: 'Fields',
  runtime: { component: 'TestInput' },
  setters: [{ key: 'placeholder', label: 'Placeholder', path: ['props', 'placeholder'], control: 'text' }],
  createNode: ({ id, field = id }) => ({
    id,
    kind: 'field',
    material: 'test.input',
    field,
    props: { placeholder: 'Name' },
    span: 12,
  }),
}

const sectionMaterial: DesignerContainerMaterialDefinition = {
  key: 'test.section',
  version: 1,
  kind: 'container',
  title: 'Section',
  category: 'Layout',
  runtime: { component: 'TestSection' },
  setters: [],
  slots: [{ name: 'default', title: 'Content', accepts: ['field'] }],
  createNode: ({ id }) => ({
    id,
    kind: 'container',
    material: 'test.section',
    slots: { default: [] },
  }),
}

const designerRegistry = createDesignerRegistry([{
  name: 'test',
  materials: [inputMaterial, sectionMaterial],
}])
const registry = createLowCodeComponentRegistry(designerRegistry)

function emptyModel(): LowCodePageModel {
  return {
    id: 'page-profile',
    name: 'Profile',
    version: 1,
    props: {},
    form: { columns: 24 },
    nodes: [],
  }
}

describe('config model', () => {
  it('projects legacy documents into explicit components, children and registered defaults', () => {
    const document = {
      version: 1 as const,
      form: { columns: 24 },
      nodes: [{
        id: 'section',
        kind: 'container' as const,
        material: 'test.section',
        slots: {
          default: [{
            id: 'name',
            kind: 'field' as const,
            material: 'test.input',
            field: 'name',
            props: { placeholder: 'Your name' },
            events: { 'update:modelValue': [{ action: 'audit' }] },
            bindings: { value: { source: 'profile.name' } },
          }],
        },
      }],
    }

    const model = designerDocumentToConfigModel(document, { id: 'page-profile', name: 'Profile' })

    expect(model.nodes[0]).toMatchObject({
      component: 'test.section',
      children: [{
        component: 'test.input',
        field: 'name',
        events: { 'update:modelValue': [{ action: 'audit' }] },
        bindings: { value: { source: 'profile.name' } },
      }],
      events: {},
      bindings: {},
      slots: {},
    })
    expect(configModelToDesignerDocument(model)).toEqual(document)
    expect(registry.get('test.input')).toMatchObject({
      component: 'test.input',
      displayName: 'Input',
      kind: 'component',
      defaults: { component: 'test.input', props: { placeholder: 'Name' } },
      bindings: [{ valueProp: 'modelValue', trigger: 'update:modelValue' }],
      layout: { span: { min: 1, max: 24 } },
    })
  })

  it('applies validated operations and returns exact inverse operations', () => {
    const section = registry.createNode('test.section', { id: 'section' })
    const field = registry.createNode('test.input', { id: 'name', field: 'name' })
    const insertedSection = applyModelOperation(emptyModel(), {
      type: 'insert',
      node: section,
      target: { parentId: null },
    }, registry)
    expect(insertedSection.success).toBe(true)
    if (!insertedSection.success)
      return

    const insertedField = applyModelOperation(insertedSection.model, {
      type: 'insert',
      node: field,
      target: { parentId: 'section' },
    }, registry)
    expect(insertedField.success).toBe(true)
    if (!insertedField.success)
      return
    expect(insertedField.model.nodes[0]!.children[0]!.id).toBe('name')

    const resized = applyModelOperation(insertedField.model, {
      type: 'resize',
      nodeId: 'name',
      span: 18,
    }, registry)
    expect(resized.success).toBe(true)
    if (!resized.success)
      return
    expect(resized.model.nodes[0]!.children[0]!.span).toBe(18)
    expect(resized.inverse).toEqual({ type: 'resize', nodeId: 'name', span: 12 })

    const definition = registry.get('test.input')!
    const constrainedRegistry = {
      ...registry,
      get: (component: string) => component === definition.component
        ? { ...definition, layout: { span: { min: 1, max: 12 } } }
        : registry.get(component),
    }
    expect(applyModelOperation(insertedField.model, {
      type: 'resize',
      nodeId: 'name',
      span: 18,
    }, constrainedRegistry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_RESIZE_INVALID' }],
    })
  })

  it('rejects unregistered components and rolls back failed batches', () => {
    const model = emptyModel()
    const unknown = {
      ...registry.createNode('test.input', { id: 'unknown', field: 'unknown' }),
      component: 'html.div',
    }
    const rejected = applyModelOperation(model, {
      type: 'insert',
      node: unknown,
      target: { parentId: null },
    }, registry)
    expect(rejected).toMatchObject({
      success: false,
      model,
      diagnostics: [{ code: 'MODEL_COMPONENT_UNKNOWN' }],
    })

    const batch = applyModelOperation(model, {
      type: 'batch',
      operations: [
        {
          type: 'insert',
          node: registry.createNode('test.input', { id: 'name', field: 'name' }),
          target: { parentId: null },
        },
        { type: 'resize', nodeId: 'name', span: 25 },
      ],
    }, registry)
    expect(batch.success).toBe(false)
    expect(batch.model).toEqual(model)
  })

  it('rejects invalid inserted subtrees before mutating the model', () => {
    const duplicateIds = registry.createNode('test.section', { id: 'section' })
    duplicateIds.children.push(
      registry.createNode('test.input', { id: 'field', field: 'first' }),
      registry.createNode('test.input', { id: 'field', field: 'second' }),
    )
    expect(applyModelOperation(emptyModel(), {
      type: 'insert',
      node: duplicateIds,
      target: { parentId: null },
    }, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_NODE_ID_DUPLICATE' }],
    })

    const unregisteredChild = registry.createNode('test.section', { id: 'section' })
    unregisteredChild.children.push({
      ...registry.createNode('test.input', { id: 'field', field: 'field' }),
      component: 'html.div',
    })
    expect(applyModelOperation(emptyModel(), {
      type: 'insert',
      node: unregisteredChild,
      target: { parentId: null },
    }, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_COMPONENT_UNKNOWN', nodeId: 'field' }],
    })

    const invalidNestedKind = registry.createNode('test.section', { id: 'section' })
    invalidNestedKind.children.push(registry.createNode('test.section', { id: 'nested-section' }))
    expect(applyModelOperation(emptyModel(), {
      type: 'insert',
      node: invalidNestedKind,
      target: { parentId: null },
    }, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_TARGET_KIND_INVALID', nodeId: 'nested-section' }],
    })
  })

  it('uses operation inverses for undo and replays operations for redo', () => {
    const history = createConfigModelHistory(emptyModel(), { revision: 4 })
    const applied = applyConfigModelOperation(history, {
      type: 'insert',
      node: registry.createNode('test.input', { id: 'name', field: 'name' }),
      target: { parentId: null },
    }, registry)
    expect(applied.changed).toBe(true)
    expect(applied.history.revision).toBe(5)
    expect(applied.history.past[0]).toMatchObject({
      operation: { type: 'insert' },
      inverse: { type: 'remove', nodeId: 'name' },
    })

    const undone = undoConfigModelHistory(applied.history, registry)
    expect(undone.history.present.nodes).toEqual([])
    expect(undone.history.revision).toBe(6)

    const redone = redoConfigModelHistory(undone.history, registry)
    expect(redone.history.present.nodes[0]!.id).toBe('name')
    expect(redone.history.revision).toBe(7)
  })

  it('does not create a history revision for an empty batch', () => {
    const history = createConfigModelHistory(emptyModel(), { revision: 4 })
    const result = applyConfigModelOperation(history, {
      type: 'batch',
      operations: [],
    }, registry)

    expect(result).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'MODEL_BATCH_EMPTY' }],
    })
    expect(result.history).toBe(history)
    expect(result.history.revision).toBe(4)
    expect(result.history.past).toEqual([])
  })

  it('duplicates complete subtrees and removes them atomically', () => {
    const section = registry.createNode('test.section', { id: 'section' })
    section.children.push(registry.createNode('test.input', { id: 'name', field: 'name' }))
    const initial = applyModelOperation(emptyModel(), {
      type: 'insert',
      node: section,
      target: { parentId: null },
    }, registry)
    expect(initial.success).toBe(true)
    if (!initial.success)
      return

    const copied = applyModelOperation(initial.model, {
      type: 'duplicate',
      nodeId: 'section',
      target: { parentId: null, index: 1 },
      idMap: { section: 'section-copy', name: 'name-copy' },
      fieldMap: { name: 'name_copy' },
    }, registry)
    expect(copied.success).toBe(true)
    if (!copied.success)
      return
    expect(copied.model.nodes[1]).toMatchObject({
      id: 'section-copy',
      children: [{ id: 'name-copy', field: 'name_copy' }],
    })
    expect(copied.inverse).toEqual({ type: 'remove', nodeId: 'section-copy' })

    const duplicateMapping = applyModelOperation(initial.model, {
      type: 'duplicate',
      nodeId: 'section',
      target: { parentId: null, index: 1 },
      idMap: { section: 'copy', name: 'copy' },
    }, registry)
    expect(duplicateMapping).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_NODE_ID_DUPLICATE' }],
    })
  })

  it('translates designer commands into model operations without replacing the model', () => {
    const document: DesignerDocument = {
      version: 1,
      form: { columns: 12 },
      nodes: [{
        id: 'name',
        kind: 'field',
        material: 'test.input',
        field: 'name',
        props: { placeholder: 'Updated name' },
        span: 18,
      }],
    }
    const update = designerCommandToModelOperation({
      type: 'updateNodePath',
      nodeId: 'name',
      path: ['props', 'placeholder'],
      value: 'Updated name',
    }, document, { route: '/profile' })
    expect(update).toEqual({
      type: 'updateProps',
      nodeId: 'name',
      props: { placeholder: 'Updated name' },
    })
    expect(designerCommandToModelOperation({
      type: 'updateForm',
      changes: { columns: 12 },
    }, document, { route: '/profile' })).toEqual({
      type: 'updatePage',
      form: { columns: 12 },
      props: { route: '/profile' },
    })
  })

  it('validates registered props, events and bindings on insert and update', () => {
    const field = registry.createNode('test.input', { id: 'name', field: 'name' })
    const inserted = applyModelOperation(emptyModel(), {
      type: 'insert',
      node: field,
      target: { parentId: null },
    }, registry)
    expect(inserted.success).toBe(true)
    if (!inserted.success)
      return

    expect(applyModelOperation(inserted.model, {
      type: 'updateProps',
      nodeId: 'name',
      props: { unknown: true },
    }, registry)).toMatchObject({ success: false, diagnostics: [{ code: 'MODEL_PROP_UNKNOWN' }] })
    expect(applyModelOperation(inserted.model, {
      type: 'updateEvents',
      nodeId: 'name',
      events: { click: [{ action: 'submit' }] },
    }, registry)).toMatchObject({ success: false, diagnostics: [{ code: 'MODEL_EVENT_UNKNOWN' }] })
    expect(applyModelOperation(inserted.model, {
      type: 'updateBindings',
      nodeId: 'name',
      bindings: { value: { source: '' } },
    }, registry)).toMatchObject({ success: false, diagnostics: [{ code: 'MODEL_BINDING_UNKNOWN' }] })
    expect(applyModelOperation(inserted.model, {
      type: 'updateEvents',
      nodeId: 'name',
      events: { 'update:modelValue': [{ action: 'audit' }] },
    }, registry)).toMatchObject({
      success: true,
      model: { nodes: [{ events: { 'update:modelValue': [{ action: 'audit' }] } }] },
    })
    expect(applyModelOperation(inserted.model, {
      type: 'updateBindings',
      nodeId: 'name',
      bindings: { value: { source: 'profile.name' } },
    }, registry)).toMatchObject({
      success: true,
      model: { nodes: [{ bindings: { value: { source: 'profile.name' } } }] },
    })

    const invalid = { ...field, props: { unknown: true } }
    expect(applyModelOperation(emptyModel(), {
      type: 'insert',
      node: invalid,
      target: { parentId: null },
    }, registry)).toMatchObject({ success: false, diagnostics: [{ code: 'MODEL_PROP_UNKNOWN' }] })
  })

  it('updates page settings through reversible model history', () => {
    const history = createConfigModelHistory(emptyModel())
    const changed = applyConfigModelOperation(history, {
      type: 'updatePage',
      form: { columns: 12, gap: '8px' },
      props: { route: '/profile' },
    }, registry)
    expect(changed.history.present).toMatchObject({
      form: { columns: 12, gap: '8px' },
      props: { route: '/profile' },
    })
    expect(undoConfigModelHistory(changed.history, registry).history.present).toEqual(emptyModel())
  })

  it('uses final-list indexes and restores same-list ordering in both directions', () => {
    const model = emptyModel()
    model.nodes = [
      registry.createNode('test.input', { id: 'first', field: 'first' }),
      registry.createNode('test.input', { id: 'second', field: 'second' }),
      registry.createNode('test.input', { id: 'third', field: 'third' }),
    ]
    const moved = applyConfigModelOperation(createConfigModelHistory(model), {
      type: 'move',
      nodeId: 'third',
      target: { parentId: null, index: 1 },
    }, registry)
    expect(moved.history.present.nodes.map(node => node.id)).toEqual(['first', 'third', 'second'])

    const undone = undoConfigModelHistory(moved.history, registry)
    expect(undone.history.present.nodes.map(node => node.id)).toEqual(['first', 'second', 'third'])

    const movedDown = applyConfigModelOperation(createConfigModelHistory(model), {
      type: 'move',
      nodeId: 'second',
      target: { parentId: null, index: 2 },
    }, registry)
    expect(movedDown.history.present.nodes.map(node => node.id)).toEqual(['first', 'third', 'second'])
    expect(undoConfigModelHistory(movedDown.history, registry).history.present.nodes.map(node => node.id))
      .toEqual(['first', 'second', 'third'])
  })
})
