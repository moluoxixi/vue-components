import { describe, expect, it } from 'vitest'
import { hitTestDesignNodes } from '../index'

function hit(nodeId: string, overrides: Partial<{
  depth: number
  order: number
  rect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
}> = {}) {
  return {
    depth: 1,
    nodeId,
    order: 0,
    rect: { bottom: 100, height: 100, left: 0, right: 100, top: 0, width: 100 },
    ...overrides,
  }
}

describe('hitTestDesignNodes', () => {
  it('keeps only hits containing the point and rejects empty rects', () => {
    const inside = hit('inside')
    const outside = hit('outside', { rect: { bottom: 100, height: 100, left: 200, right: 300, top: 0, width: 100 } })
    const collapsed = hit('collapsed', { rect: { bottom: 50, height: 0, left: 0, right: 100, top: 50, width: 100 } })
    expect(hitTestDesignNodes({ x: 50, y: 50 }, [outside, collapsed, inside]).map(entry => entry.nodeId))
      .toEqual(['inside'])
  })

  it('ranks by depth, then smaller area, then later registration order', () => {
    const shallow = hit('shallow', { depth: 1, order: 3 })
    const deepLarge = hit('deep-large', { depth: 2, order: 1 })
    const deepSmall = hit('deep-small', { depth: 2, order: 0, rect: { bottom: 60, height: 20, left: 40, right: 60, top: 40, width: 20 } })
    const deepSmallLater = hit('deep-small-later', { depth: 2, order: 2, rect: { bottom: 60, height: 20, left: 40, right: 60, top: 40, width: 20 } })
    expect(hitTestDesignNodes({ x: 50, y: 50 }, [shallow, deepLarge, deepSmall, deepSmallLater]).map(entry => entry.nodeId))
      .toEqual(['deep-small-later', 'deep-small', 'deep-large', 'shallow'])
  })
})
