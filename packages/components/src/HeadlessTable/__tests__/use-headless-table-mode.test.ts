import type { HeadlessTableModeChange } from '../src/types'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useHeadlessTableMode } from '../src/composables'

describe('useHeadlessTableMode', () => {
  it('reports effective mode transitions and ignores no-op mutations', () => {
    const propMode = ref<'default' | 'edit'>('edit')
    const onModeChange = vi.fn<(change: HeadlessTableModeChange) => void>()
    const api = useHeadlessTableMode({
      mode: () => propMode.value,
      onModeChange,
    })

    api.setMode('default')
    api.setMode('default')
    api.setRowMode('R-1', 'edit')
    api.setCellMode('R-1', 'name', 'default')
    api.clearCellMode('R-1', 'name')
    api.clearRowMode('R-1')
    api.clearMode()

    expect(onModeChange.mock.calls.map(([change]) => change)).toEqual([
      { scope: 'table', action: 'set', mode: 'default', previousMode: 'edit' },
      { scope: 'row', action: 'set', rowId: 'R-1', mode: 'edit', previousMode: 'default' },
      { scope: 'cell', action: 'set', rowId: 'R-1', columnId: 'name', mode: 'default', previousMode: 'edit' },
      { scope: 'cell', action: 'clear', rowId: 'R-1', columnId: 'name', mode: 'edit', previousMode: 'default' },
      { scope: 'row', action: 'clear', rowId: 'R-1', mode: 'default', previousMode: 'edit' },
      { scope: 'table', action: 'clear', mode: 'edit', previousMode: 'default' },
    ])
  })

  it('clears row, cell, and all overrides independently with one event', () => {
    const onModeChange = vi.fn<(change: HeadlessTableModeChange) => void>()
    const api = useHeadlessTableMode({ onModeChange })

    api.setMode('edit')
    api.setRowMode('R-1', 'default')
    api.setRowMode('R-2', 'default')
    api.setCellMode('R-1', 'name', 'edit')
    api.setCellMode('R-2', 'status', 'edit')
    onModeChange.mockClear()

    api.clearAllRowModes()
    expect(api.getRowMode('R-1')).toBe('edit')
    expect(api.getCellMode('R-1', 'name')).toBe('edit')
    expect(onModeChange).toHaveBeenLastCalledWith({
      action: 'clearAll',
      cleared: 2,
      mode: 'edit',
      scope: 'row',
    })

    api.clearAllCellModes()
    expect(api.getCellMode('R-1', 'name')).toBe('edit')
    expect(onModeChange).toHaveBeenLastCalledWith({
      action: 'clearAll',
      cleared: 2,
      mode: 'edit',
      scope: 'cell',
    })

    api.setRowMode('R-1', 'default')
    api.setCellMode('R-1', 'name', 'edit')
    onModeChange.mockClear()
    api.clearAllModes()

    expect(api.mode.value).toBe('default')
    expect(api.getRowMode('R-1')).toBe('default')
    expect(api.getCellMode('R-1', 'name')).toBe('default')
    expect(onModeChange).toHaveBeenCalledOnce()
    expect(onModeChange).toHaveBeenCalledWith({
      action: 'clearAll',
      cleared: 3,
      mode: 'default',
      scope: 'all',
    })

    api.clearAllModes()
    expect(onModeChange).toHaveBeenCalledOnce()
  })
})
