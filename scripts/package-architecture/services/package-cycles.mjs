import { diagnostic } from './rule-utils.mjs'
import { collectStronglyConnectedComponents } from './strongly-connected-components.mjs'

const RUNTIME_DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']

export function collectPackageCycleDiagnostics(_repositoryRoot, packages) {
  const packagesByName = new Map(packages
    .filter(pkg => typeof pkg.name === 'string' && pkg.name)
    .map(pkg => [pkg.name, pkg]))
  const compareNames = (left, right) => packagesByName.get(left).relativeRoot.localeCompare(packagesByName.get(right).relativeRoot, 'en')
  const names = [...packagesByName.keys()].sort(compareNames)
  const dependencies = new Map(names.map((name) => {
    const manifest = packagesByName.get(name).manifest
    const internal = new Set(RUNTIME_DEPENDENCY_FIELDS.flatMap((field) => {
      const entries = manifest[field]
      return entries && typeof entries === 'object' && !Array.isArray(entries)
        ? Object.keys(entries).filter(dependency => packagesByName.has(dependency))
        : []
    }))
    return [name, [...internal].sort(compareNames)]
  }))

  return collectStronglyConnectedComponents(names, dependencies)
    .filter(component => component.length > 1 || dependencies.get(component[0])?.includes(component[0]))
    .map((component) => {
      const members = component.sort(compareNames)
      const paths = members.map(name => `${packagesByName.get(name).relativeRoot}/package.json`)
      const [path, ...owners] = paths
      const packageRoot = packagesByName.get(members[0]).relativeRoot
      const message = owners.length
        ? `Workspace package dependency cycle detected among: ${members.join(', ')}.`
        : `Workspace package dependency cycle detected: ${members[0]} depends on itself.`
      return diagnostic('package.circular-dependency', path, packageRoot, message, owners)
    })
    .sort((left, right) => (
      left.path.localeCompare(right.path)
      || JSON.stringify(left.owners ?? []).localeCompare(JSON.stringify(right.owners ?? []))
    ))
}
