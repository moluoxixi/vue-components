/**
 * Shared design-mode pointer hit-testing. The designer canvas and the
 * runtime-host iframe must resolve the same node for the same point, so both
 * feed their geometry through this single implementation: deepest node first,
 * then the smallest rect, then the most recently registered one.
 */
export function hitTestDesignNodes<Hit extends {
  depth: number
  order: number
  rect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
}>(point: { x: number, y: number }, hits: readonly Hit[]): Hit[] {
  return hits
    .flatMap((hit) => {
      const rect = hit.rect
      if (rect.width <= 0 || rect.height <= 0
        || point.x < rect.left || point.x > rect.right
        || point.y < rect.top || point.y > rect.bottom) {
        return []
      }
      return [{ area: rect.width * rect.height, hit }]
    })
    .sort((left, right) => right.hit.depth - left.hit.depth
      || left.area - right.area
      || right.hit.order - left.hit.order)
    .map(({ hit }) => hit)
}
