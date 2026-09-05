import { normalizeRepositoryPath } from '../utils/index.mjs'
import { createModuleGraph } from './module-graph.mjs'
import { diagnostic, isProductionModule } from './rule-utils.mjs'

function collectStronglyConnectedComponents(files, dependencies) {
  const components = []
  const indices = new Map()
  const lowLinks = new Map()
  const stack = []
  const onStack = new Set()
  let nextIndex = 0

  function visit(file) {
    indices.set(file, nextIndex)
    lowLinks.set(file, nextIndex)
    nextIndex += 1
    stack.push(file)
    onStack.add(file)

    for (const dependency of dependencies.get(file) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency)
        lowLinks.set(file, Math.min(lowLinks.get(file), lowLinks.get(dependency)))
      }
      else if (onStack.has(dependency)) {
        lowLinks.set(file, Math.min(lowLinks.get(file), indices.get(dependency)))
      }
    }

    if (lowLinks.get(file) !== indices.get(file))
      return

    const component = []
    let member
    do {
      member = stack.pop()
      onStack.delete(member)
      component.push(member)
    } while (member !== file)
    components.push(component)
  }

  for (const file of files) {
    if (!indices.has(file))
      visit(file)
  }
  return components
}

export function collectModuleCycleDiagnostics(repositoryRoot, packages) {
  return packages.flatMap((pkg) => {
    const graph = createModuleGraph(pkg.sourceRoot)
    const compareFiles = (left, right) => normalizeRepositoryPath(repositoryRoot, left)
      .localeCompare(normalizeRepositoryPath(repositoryRoot, right), 'en')
    const files = graph.files.filter(isProductionModule).sort(compareFiles)
    const fileSet = new Set(files)
    const dependencies = new Map(files.map(file => [
      file,
      [...(graph.modules.get(file)?.dependencies ?? [])]
        .filter(dependency => fileSet.has(dependency))
        .sort(compareFiles),
    ]))

    return collectStronglyConnectedComponents(files, dependencies)
      .filter(component => component.length > 1 || dependencies.get(component[0])?.includes(component[0]))
      .map((component) => {
        const members = component
          .map(file => normalizeRepositoryPath(repositoryRoot, file))
          .sort((left, right) => left.localeCompare(right, 'en'))
        const [path, ...owners] = members
        const message = owners.length
          ? `Production module dependency cycle detected among: ${members.join(', ')}.`
          : `Production module dependency cycle detected: ${path} imports itself.`
        return diagnostic('module.circular-dependency', path, pkg.relativeRoot, message, owners)
      })
  }).sort((left, right) => (
    left.path.localeCompare(right.path)
    || JSON.stringify(left.owners ?? []).localeCompare(JSON.stringify(right.owners ?? []))
  ))
}
