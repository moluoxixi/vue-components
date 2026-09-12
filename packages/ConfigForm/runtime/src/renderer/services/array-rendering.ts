import type { ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type { ConfigFormComponentNode, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { Component, VNodeChild } from 'vue'
import type { ConfigFormRendererCellAttrs, ConfigFormRendererFieldAttrs, ConfigFormRuntimeNodeMetadata } from '../types'
import type { RendererPipelineContext, RendererSlots } from '../types/internal'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from '@lucide/vue'
import { resolveConfigFormCondition } from '@moluoxixi/config-form-headless'
import { h } from 'vue'
import { arraySlotColumns } from './renderer-slots'
import { toDomId } from './rendering'

export type RuntimeArrayComponentNode<TValues extends ConfigFormValues> = ConfigFormComponentNode<
  TValues,
Component | string,
ConfigFormRendererFieldAttrs,
ConfigFormRendererCellAttrs
> & { id: string }

type RenderInstance<TValues extends ConfigFormValues> = (
  node: RuntimeArrayComponentNode<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
  metadata: ConfigFormRuntimeNodeMetadata<TValues>,
  registerElement: boolean,
  scope: ConfigFormScopePath,
  slots?: RendererSlots,
) => VNodeChild

type CreateSlots<TValues extends ConfigFormValues> = (
  node: RuntimeArrayComponentNode<TValues>,
  path: string,
  ancestors: ReadonlySet<object>,
  scope: ConfigFormScopePath,
) => RendererSlots

export function createArrayRenderer<TValues extends ConfigFormValues>(
  context: RendererPipelineContext<TValues>,
  renderInstance: RenderInstance<TValues>,
  createNodeSlots: CreateSlots<TValues>,
) {
  return (
    node: RuntimeArrayComponentNode<TValues>,
    path: string,
    ancestors: ReadonlySet<object>,
    metadata: ConfigFormRuntimeNodeMetadata<TValues>,
    registerElement: boolean,
    parentScope: ConfigFormScopePath,
  ): VNodeChild => {
    const { bem, cancelScope, controller, editorBridge, props } = context
    const design = props.mode === 'design'
    const allRows = controller.listRows(node.id, parentScope)
    // Design presents a single existing template instance, never a business mutation.
    const rows = design ? allRows.slice(0, 1) : allRows
    const maximum = node.valueScope?.maxItems
    const minimum = node.valueScope?.minItems ?? 0
    const locked = design
      || resolveConfigFormCondition(props.readonly, controller.model.value, false)
      || [...ancestors, node].some((ancestor) => {
        const candidate = ancestor as RuntimeArrayComponentNode<TValues>
        return isContainerLocked(candidate.props?.disabled, controller.model.value)
          || isContainerLocked(candidate.props?.readonly, controller.model.value)
      })
    const addDisabled = locked || (maximum !== undefined && allRows.length >= maximum)
    const table = node.props?.arrayDisplay === 'table'
    const columns = arraySlotColumns(node)
    const label = typeof node.props?.title === 'string' && node.props.title ? node.props.title : node.valueScope!.field
    const headerId = (index: number) => `${context.formId}-${toDomId(path)}-column-${index}`

    function rowActions(row: typeof rows[number], index: number): VNodeChild {
      if (design)
        return null
      return h('div', {
        'aria-label': `Row ${index + 1} actions`,
        'class': bem('array-row-actions'),
        'data-config-form-row-actions': '',
        'role': 'group',
      }, [
        rowActionButton('Duplicate row', 'duplicate', Copy, addDisabled, () => {
          controller.duplicateRow(node.id, row.rowId, parentScope)
        }),
        rowActionButton('Move row up', 'move-up', ArrowUp, locked || index === 0, () => {
          controller.moveRow(node.id, row.rowId, index - 1, parentScope)
        }),
        rowActionButton('Move row down', 'move-down', ArrowDown, locked || index === allRows.length - 1, () => {
          controller.moveRow(node.id, row.rowId, index + 1, parentScope)
        }),
        rowActionButton('Remove row', 'remove', Trash2, locked || allRows.length <= minimum, () => {
          controller.removeRow(node.id, row.rowId, parentScope)
          cancelScope(row.scope)
        }),
      ])
    }

    function renderRows(): VNodeChild[] {
      return rows.map((row, index) => {
        const rowPath = `${path}.rows.${row.rowId}`
        const rowMetadata = editorBridge.createNodeMetadata(node, rowPath, row.scope, metadata.slot)
        const attrs = { 'class': bem('array-row'), 'data-config-form-row': '', 'data-row-id': row.rowId, 'key': row.rowId }
        if (!table) {
          return h('div', attrs, [
            renderInstance(node, rowPath, ancestors, rowMetadata, false, row.scope),
            rowActions(row, index),
          ])
        }
        const content = createNodeSlots(node, rowPath, ancestors, row.scope)?.default?.()
        const cells = Array.isArray(node.slots?.default) && Array.isArray(content) ? content : [content]
        return h('tr', attrs, [
          ...columns.map((column, columnIndex) => h('td', {
            'class': bem('array-cell'),
            'data-config-form-array-column': column.key,
            'headers': headerId(columnIndex),
            'key': column.key,
          }, [cells[columnIndex]])),
          ...(design ? [] : [h('td', { class: bem('array-actions-cell'), headers: headerId(columns.length) }, [rowActions(row, index)])]),
        ])
      })
    }

    const addAction = () => design
      ? null
      : h('div', {
          'class': bem('array-actions'),
          'data-config-form-array-actions': '',
        }, [rowActionButton('Add row', 'append', Plus, addDisabled, () => {
          controller.appendRow(node.id, undefined, parentScope)
        })])

    const content = table
      ? renderInstance(node, path, ancestors, metadata, false, parentScope, {
          default: () => [
            h('div', {
              'aria-label': label,
              'class': bem('array-scroll'),
              'data-config-form-array-scroll': '',
              'role': 'region',
              'tabindex': design ? undefined : 0,
            }, [h('table', { 'aria-label': label, 'class': bem('array-table'), 'data-config-form-array-table': '' }, [
              h('thead', [h('tr', [
                ...columns.map((column, index) => h('th', { id: headerId(index), scope: 'col', key: column.key }, column.title)),
                ...(design ? [] : [h('th', { id: headerId(columns.length), scope: 'col' }, 'Actions')]),
              ])]),
              h('tbody', rows.length > 0
                ? renderRows()
                : [h('tr', [h('td', {
                    class: bem('array-empty'),
                    colspan: Math.max(1, columns.length + (design ? 0 : 1)),
                  }, 'No rows')])]),
            ])]),
            addAction(),
          ],
        })
      : [...renderRows(), addAction()]
    const metadataAttrs = registerElement ? editorBridge.nodeMetadataAttrs(metadata) : {}
    return h('div', {
      ...metadataAttrs,
      'class': [bem('array'), metadataAttrs.class],
      'data-config-form-array': node.id,
      'data-array-display': table ? 'table' : 'list',
      'key': `${path}.array`,
      ...(registerElement ? { ref: (element: unknown) => editorBridge.registerNodeElement(metadata, element) } : {}),
    }, [content])
  }
}

function isContainerLocked<TValues extends ConfigFormValues>(condition: unknown, values: TValues): boolean {
  return condition === true
    || (typeof condition === 'function' && Boolean((condition as (current: TValues) => unknown)(values)))
}

function rowActionButton(label: string, action: string, icon: Component, disabled: boolean, run: () => void): VNodeChild {
  return h('button', {
    'aria-label': label,
    'data-config-form-row-action': action,
    disabled,
    'title': label,
    'type': 'button',
    'onClick': () => {
      if (!disabled)
        run()
    },
  }, [h(icon, { 'aria-hidden': 'true', 'focusable': 'false', 'size': 16, 'stroke-width': 1.75 })])
}
