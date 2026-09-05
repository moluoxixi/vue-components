export function collectStronglyConnectedComponents(nodes, dependencies) {
  const components = []
  const indices = new Map()
  const lowLinks = new Map()
  const stack = []
  const onStack = new Set()
  let nextIndex = 0

  function visit(node) {
    indices.set(node, nextIndex)
    lowLinks.set(node, nextIndex)
    nextIndex += 1
    stack.push(node)
    onStack.add(node)

    for (const dependency of dependencies.get(node) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency)
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(dependency)))
      }
      else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(dependency)))
      }
    }

    if (lowLinks.get(node) !== indices.get(node))
      return

    const component = []
    let member
    do {
      member = stack.pop()
      onStack.delete(member)
      component.push(member)
    } while (member !== node)
    components.push(component)
  }

  for (const node of nodes) {
    if (!indices.has(node))
      visit(node)
  }
  return components
}
